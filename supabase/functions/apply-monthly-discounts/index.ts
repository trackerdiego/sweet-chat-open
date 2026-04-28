// Cron-driven: aplica coins + créditos como desconto na próxima fatura Asaas.
// Disparado pelo crontab da VPS (curl com Authorization: Bearer CRON_SECRET).
// Roda diariamente; só processa subs cujo current_period_end cai em ~2 dias.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";
const COIN_TO_BRL = 0.01;
const APPLY_WINDOW_DAYS = 2; // aplica 2 dias antes da renovação

function periodMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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

  // Janela: pega subs ativas que renovam em até APPLY_WINDOW_DAYS dias
  const now = new Date();
  const windowEnd = new Date(now.getTime() + APPLY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { data: subs, error } = await admin
    .from("subscription_state")
    .select("user_id, asaas_subscription_id, current_period_end, plan")
    .eq("status", "active")
    .not("asaas_subscription_id", "is", null)
    .not("current_period_end", "is", null)
    .lte("current_period_end", windowEnd.toISOString())
    .gte("current_period_end", now.toISOString());

  if (error) {
    console.error("query subs failed:", error);
    return new Response(JSON.stringify({ error: "query failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ user_id: string; status: string; detail?: unknown }> = [];

  for (const s of subs ?? []) {
    try {
      const userId = s.user_id as string;
      const asaasSubId = s.asaas_subscription_id as string;
      const period = periodMonth(new Date(s.current_period_end as string));

      // Idempotência: já aplicou neste período?
      const { data: existing } = await admin
        .from("monthly_redemptions")
        .select("id")
        .eq("user_id", userId)
        .eq("period_month", period)
        .maybeSingle();
      if (existing) { results.push({ user_id: userId, status: "skip_already_applied" }); continue; }

      // Lê wallet
      const { data: wallet } = await admin
        .from("user_wallet")
        .select("coins_balance, referral_credits_brl")
        .eq("user_id", userId)
        .maybeSingle();
      const coins = wallet?.coins_balance ?? 0;
      const credits = Number(wallet?.referral_credits_brl ?? 0);
      const totalBrlAvailable = coins * COIN_TO_BRL + credits;
      if (totalBrlAvailable <= 0) { results.push({ user_id: userId, status: "skip_no_balance" }); continue; }

      // Busca valor atual da subscription no Asaas
      const subRes = await fetch(`${ASAAS_BASE}/subscriptions/${asaasSubId}`, {
        headers: { access_token: ASAAS_API_KEY },
      });
      if (!subRes.ok) { results.push({ user_id: userId, status: "asaas_get_failed" }); continue; }
      const subData = await subRes.json();
      const fullPrice = Number(subData.value ?? 0);
      if (fullPrice <= 0) { results.push({ user_id: userId, status: "skip_no_price" }); continue; }

      // Calcula desconto (cap no valor da fatura - R$1 mínimo pra não zerar)
      const maxDiscount = Math.max(0, fullPrice - 1);
      const discount = Math.min(totalBrlAvailable, maxDiscount);
      if (discount <= 0) { results.push({ user_id: userId, status: "skip_capped_zero" }); continue; }

      // Distribui: gasta créditos BRL primeiro, depois coins
      let creditsUsed = Math.min(credits, discount);
      let remaining = discount - creditsUsed;
      let coinsUsed = Math.ceil(remaining / COIN_TO_BRL);
      if (coinsUsed > coins) coinsUsed = coins;
      // recalcula desconto efetivo (coins arredondados pra cima podem ter ajustado)
      const effectiveDiscount = Number((creditsUsed + coinsUsed * COIN_TO_BRL).toFixed(2));
      const newValue = Number((fullPrice - effectiveDiscount).toFixed(2));

      // PATCH na subscription Asaas
      const patchRes = await fetch(`${ASAAS_BASE}/subscriptions/${asaasSubId}`, {
        method: "POST", // Asaas usa POST pra update
        headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
        body: JSON.stringify({ value: newValue, updatePendingPayments: true }),
      });
      if (!patchRes.ok) {
        const err = await patchRes.text();
        console.error("asaas patch failed:", err);
        results.push({ user_id: userId, status: "asaas_patch_failed", detail: err });
        continue;
      }

      // Insere redemption (idempotência via UNIQUE)
      const { error: redErr } = await admin.from("monthly_redemptions").insert({
        user_id: userId,
        period_month: period,
        coins_used: coinsUsed,
        credits_used_brl: creditsUsed,
        discount_brl_total: effectiveDiscount,
        asaas_subscription_id: asaasSubId,
      });
      if (redErr) {
        console.error("redemption insert failed (likely duplicate):", redErr);
        results.push({ user_id: userId, status: "duplicate_skip" });
        continue;
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
          reference_id: `redeem-${period}`,
          metadata: { discount_brl: effectiveDiscount, credits_used_brl: creditsUsed, period_month: period, full_price: fullPrice, new_value: newValue },
        });
      }

      results.push({ user_id: userId, status: "applied", detail: { discount: effectiveDiscount, newValue, coinsUsed, creditsUsed } });
    } catch (err) {
      console.error("loop error:", err);
      results.push({ user_id: s.user_id as string, status: "error", detail: String(err) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
