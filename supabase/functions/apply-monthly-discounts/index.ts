// Cron-driven: aplica benefícios de coins/créditos de acordo com o plano.
// - Mensal: desconto direto na próxima fatura Asaas (PATCH value), teto 50%.
// - Anual: estende nextDueDate em +30 dias a cada 2.475 coins (cap 6 meses/ano).
// Disparado pelo crontab da VPS (curl com Authorization: Bearer CRON_SECRET).
// Roda diariamente.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";
const COIN_TO_BRL = 0.01;
const APPLY_WINDOW_DAYS = 2; // mensal: aplica 2 dias antes da renovação
const MONTHLY_DISCOUNT_CAP_PCT = 0.5; // teto 50% no mensal
const ANNUAL_COINS_PER_MONTH = 2475; // 2.475 coins = +30 dias
const ANNUAL_DAYS_PER_REDEMPTION = 30;
const ANNUAL_MAX_MONTHS_PER_CYCLE = 6; // até +6 meses em 12 meses

function periodMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentPeriodMonth(): string {
  return periodMonth(new Date());
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// =============== Branch MENSAL ===============
async function processMonthly(admin: any, s: any, apiKey: string) {
  const userId = s.user_id as string;
  const asaasSubId = s.asaas_subscription_id as string;
  const period = periodMonth(new Date(s.current_period_end as string));

  // Idempotência por período
  const { data: existing } = await admin
    .from("monthly_redemptions")
    .select("id")
    .eq("user_id", userId)
    .eq("period_month", period)
    .maybeSingle();
  if (existing) return { user_id: userId, status: "monthly_skip_already_applied" };

  // Lê wallet
  const { data: wallet } = await admin
    .from("user_wallet")
    .select("coins_balance, referral_credits_brl")
    .eq("user_id", userId)
    .maybeSingle();
  const coins = wallet?.coins_balance ?? 0;
  const credits = Number(wallet?.referral_credits_brl ?? 0);
  const totalBrlAvailable = coins * COIN_TO_BRL + credits;
  if (totalBrlAvailable <= 0) return { user_id: userId, status: "monthly_skip_no_balance" };

  // Busca valor atual da subscription no Asaas
  const subRes = await fetch(`${ASAAS_BASE}/subscriptions/${asaasSubId}`, {
    headers: { access_token: apiKey },
  });
  if (!subRes.ok) return { user_id: userId, status: "monthly_asaas_get_failed" };
  const subData = await subRes.json();
  const fullPrice = Number(subData.value ?? 0);
  if (fullPrice <= 0) return { user_id: userId, status: "monthly_skip_no_price" };

  // Teto 50% do plano (e nunca zerar a fatura)
  const maxDiscount = Math.min(fullPrice * MONTHLY_DISCOUNT_CAP_PCT, fullPrice - 1);
  const discount = Math.min(totalBrlAvailable, Math.max(0, maxDiscount));
  if (discount <= 0) return { user_id: userId, status: "monthly_skip_capped_zero" };

  // Distribui: créditos BRL primeiro, depois coins
  const creditsUsed = Math.min(credits, discount);
  const remaining = discount - creditsUsed;
  let coinsUsed = Math.ceil(remaining / COIN_TO_BRL);
  if (coinsUsed > coins) coinsUsed = coins;
  const effectiveDiscount = Number((creditsUsed + coinsUsed * COIN_TO_BRL).toFixed(2));
  const newValue = Number((fullPrice - effectiveDiscount).toFixed(2));

  // PATCH na subscription Asaas
  const patchRes = await fetch(`${ASAAS_BASE}/subscriptions/${asaasSubId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify({ value: newValue, updatePendingPayments: true }),
  });
  if (!patchRes.ok) {
    const err = await patchRes.text();
    console.error("monthly asaas patch failed:", err);
    return { user_id: userId, status: "monthly_asaas_patch_failed", detail: err };
  }

  // Insere redemption (idempotência via UNIQUE em monthly_redemptions(user_id, period_month) seria ideal)
  const { error: redErr } = await admin.from("monthly_redemptions").insert({
    user_id: userId,
    period_month: period,
    coins_used: coinsUsed,
    credits_used_brl: creditsUsed,
    discount_brl_total: effectiveDiscount,
    asaas_subscription_id: asaasSubId,
  });
  if (redErr) {
    console.error("monthly redemption insert failed:", redErr);
    return { user_id: userId, status: "monthly_duplicate_skip" };
  }

  // Debita wallet
  await admin.from("user_wallet").update({
    coins_balance: coins - coinsUsed,
    referral_credits_brl: Number((credits - creditsUsed).toFixed(2)),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  // Loga em coin_transactions (idempotente via reference_id único)
  if (coinsUsed > 0) {
    await admin.from("coin_transactions").insert({
      user_id: userId,
      amount: -coinsUsed,
      type: "redeem_discount",
      reference_id: `redeem-monthly-${period}`,
      metadata: {
        discount_brl: effectiveDiscount,
        credits_used_brl: creditsUsed,
        period_month: period,
        full_price: fullPrice,
        new_value: newValue,
        plan: "monthly",
      },
    });
  }

  return { user_id: userId, status: "monthly_applied", detail: { discount: effectiveDiscount, newValue, coinsUsed, creditsUsed } };
}

// =============== Branch ANUAL ===============
async function processAnnual(admin: any, s: any, apiKey: string) {
  const userId = s.user_id as string;
  const asaasSubId = s.asaas_subscription_id as string;
  const period = currentPeriodMonth();

  // Idempotência mensal: já estendeu este mês?
  const { data: existing } = await admin
    .from("monthly_redemptions")
    .select("id")
    .eq("user_id", userId)
    .eq("period_month", period)
    .maybeSingle();
  if (existing) return { user_id: userId, status: "annual_skip_already_applied" };

  // Lê wallet
  const { data: wallet } = await admin
    .from("user_wallet")
    .select("coins_balance")
    .eq("user_id", userId)
    .maybeSingle();
  const coins = wallet?.coins_balance ?? 0;
  if (coins < ANNUAL_COINS_PER_MONTH) {
    return { user_id: userId, status: "annual_skip_insufficient_coins", detail: { coins } };
  }

  // Cap: máximo 6 meses extras nos últimos 12 meses (soma de redemptions tipo annual)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 12);
  const { data: recentRedemptions } = await admin
    .from("monthly_redemptions")
    .select("coins_used")
    .eq("user_id", userId)
    .eq("asaas_subscription_id", asaasSubId)
    .gte("applied_at", twelveMonthsAgo.toISOString());

  const monthsAlreadyAdded = (recentRedemptions ?? [])
    .reduce((sum: number, r: any) => sum + Math.floor((r.coins_used ?? 0) / ANNUAL_COINS_PER_MONTH), 0);
  const monthsRemainingInCap = ANNUAL_MAX_MONTHS_PER_CYCLE - monthsAlreadyAdded;
  if (monthsRemainingInCap <= 0) {
    return { user_id: userId, status: "annual_skip_cap_reached", detail: { monthsAlreadyAdded } };
  }

  // Quantos meses extras este ciclo permite agora
  const monthsByCoins = Math.floor(coins / ANNUAL_COINS_PER_MONTH);
  const monthsToAdd = Math.min(monthsByCoins, monthsRemainingInCap);
  if (monthsToAdd <= 0) return { user_id: userId, status: "annual_skip_zero_months" };

  const coinsUsed = monthsToAdd * ANNUAL_COINS_PER_MONTH;
  const daysToAdd = monthsToAdd * ANNUAL_DAYS_PER_REDEMPTION;

  // Busca subscription no Asaas pra pegar nextDueDate atual
  const subRes = await fetch(`${ASAAS_BASE}/subscriptions/${asaasSubId}`, {
    headers: { access_token: apiKey },
  });
  if (!subRes.ok) return { user_id: userId, status: "annual_asaas_get_failed" };
  const subData = await subRes.json();
  if (!subData.nextDueDate) return { user_id: userId, status: "annual_no_next_due_date" };

  const currentNextDue = new Date(subData.nextDueDate);
  const newNextDue = addDays(currentNextDue, daysToAdd);
  const newNextDueStr = newNextDue.toISOString().slice(0, 10); // YYYY-MM-DD

  // PATCH no Asaas
  const patchRes = await fetch(`${ASAAS_BASE}/subscriptions/${asaasSubId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify({ nextDueDate: newNextDueStr, updatePendingPayments: true }),
  });
  if (!patchRes.ok) {
    const err = await patchRes.text();
    console.error("annual asaas patch failed:", err);
    return { user_id: userId, status: "annual_asaas_patch_failed", detail: err };
  }

  // Insere redemption (discount_brl_total = 0 marca que NÃO é desconto — é extensão)
  const { error: redErr } = await admin.from("monthly_redemptions").insert({
    user_id: userId,
    period_month: period,
    coins_used: coinsUsed,
    credits_used_brl: 0,
    discount_brl_total: 0,
    asaas_subscription_id: asaasSubId,
  });
  if (redErr) {
    console.error("annual redemption insert failed:", redErr);
    return { user_id: userId, status: "annual_duplicate_skip" };
  }

  // Debita coins
  await admin.from("user_wallet").update({
    coins_balance: coins - coinsUsed,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  // Sincroniza subscription_state
  await admin.from("subscription_state").update({
    current_period_end: newNextDue.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  // Log
  await admin.from("coin_transactions").insert({
    user_id: userId,
    amount: -coinsUsed,
    type: "redeem_extension",
    reference_id: `redeem-annual-${period}`,
    metadata: {
      months_added: monthsToAdd,
      days_added: daysToAdd,
      previous_next_due: currentNextDue.toISOString(),
      new_next_due: newNextDue.toISOString(),
      period_month: period,
      plan: "annual",
    },
  });

  return {
    user_id: userId,
    status: "annual_applied",
    detail: { monthsToAdd, daysToAdd, coinsUsed, newNextDue: newNextDueStr },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: token do cron
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization") ?? "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
  if (!ASAAS_API_KEY) {
    return new Response(JSON.stringify({ error: "missing ASAAS_API_KEY" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const windowEnd = new Date(now.getTime() + APPLY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Pega TODAS as subs ativas (vamos filtrar por plano dentro do loop)
  const { data: subs, error } = await admin
    .from("subscription_state")
    .select("user_id, asaas_subscription_id, current_period_end, plan")
    .eq("status", "active")
    .not("asaas_subscription_id", "is", null)
    .not("current_period_end", "is", null);

  if (error) {
    console.error("query subs failed:", error);
    return new Response(JSON.stringify({ error: "query failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ user_id: string; status: string; detail?: unknown }> = [];

  for (const s of subs ?? []) {
    try {
      const plan = (s.plan as string) || "monthly";
      if (plan === "annual") {
        // Anual: roda mensalmente, sem janela
        results.push(await processAnnual(admin, s, ASAAS_API_KEY));
      } else {
        // Mensal: só processa se renovação cai na janela
        const periodEnd = new Date(s.current_period_end as string);
        if (periodEnd < now || periodEnd > windowEnd) {
          results.push({ user_id: s.user_id, status: "monthly_skip_outside_window" });
          continue;
        }
        results.push(await processMonthly(admin, s, ASAAS_API_KEY));
      }
    } catch (err) {
      console.error("loop error:", err);
      results.push({ user_id: s.user_id as string, status: "error", detail: String(err) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
