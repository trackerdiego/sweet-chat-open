import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token, x-cron-secret",
};

const ASAAS_BASE = "https://api.asaas.com/v3";
const REFERRAL_CREDIT_BRL = 10;

// ---------- Helpers ----------
function inferPlanFromValue(value: number | undefined | null): "monthly" | "annual" | null {
  if (value == null) return null;
  const v = Number(value);
  if (v >= 250) return "annual"; // 297 / 397
  if (v >= 30) return "monthly"; // 47
  return null;
}

function addDaysISO(baseISO: string | Date, days: number): string {
  const d = new Date(baseISO);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function isoDate(d: any): string | null {
  if (!d) return null;
  try { return new Date(d).toISOString(); } catch { return null; }
}

async function fetchSubscription(asaasSubId: string, apiKey: string) {
  try {
    const res = await fetch(`${ASAAS_BASE}/subscriptions/${asaasSubId}`, {
      headers: { access_token: apiKey },
    });
    return res.ok ? await res.json() : null;
  } catch (e) {
    console.error("fetchSubscription error:", e);
    return null;
  }
}

async function fetchPixQrCode(paymentId: string, apiKey: string): Promise<{ encodedImage: string; payload: string } | null> {
  try {
    const res = await fetch(`${ASAAS_BASE}/payments/${paymentId}/pixQrCode`, {
      headers: { access_token: apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      encodedImage: data.encodedImage ?? "", // base64 PNG sem prefixo
      payload: data.payload ?? "",            // copia-e-cola
    };
  } catch (e) {
    console.error("fetchPixQrCode error:", e);
    return null;
  }
}

async function clearNextInvoice(admin: any, userId: string) {
  await admin
    .from("subscription_state")
    .update({ next_invoice: null, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

async function setNextInvoice(admin: any, userId: string, invoice: Record<string, unknown>) {
  await admin
    .from("subscription_state")
    .update({ next_invoice: invoice, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

// ---------- Audit log (idempotência) ----------
async function logWebhookEvent(admin: any, body: any, userId: string | null) {
  const eventId: string | undefined = body?.id;
  if (!eventId) {
    console.warn("Webhook sem event id — pulando audit log");
    return { alreadyProcessed: false };
  }
  const { error } = await admin.from("asaas_webhook_events").insert({
    event_id: eventId,
    event_type: body.event ?? "unknown",
    payload: body,
    user_id: userId,
  });
  if (error) {
    if (String(error.code) === "23505" || String(error.message ?? "").includes("duplicate")) {
      // Já recebemos esse event_id antes
      const { data: prior } = await admin
        .from("asaas_webhook_events")
        .select("processed_at")
        .eq("event_id", eventId)
        .maybeSingle();
      return { alreadyProcessed: !!prior?.processed_at };
    }
    console.error("audit log insert error:", error);
  }
  return { alreadyProcessed: false };
}

async function markProcessed(admin: any, eventId: string | undefined, errorMsg?: string) {
  if (!eventId) return;
  await admin
    .from("asaas_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      processing_error: errorMsg ?? null,
    })
    .eq("event_id", eventId);
}

// ---------- Referral ----------
async function processReferralPayment(admin: any, userId: string) {
  const { data: refRow } = await admin
    .from("referrals")
    .select("id, referrer_id, status")
    .eq("referred_user_id", userId)
    .eq("status", "pending")
    .maybeSingle();

  if (!refRow) return;

  const { error: upErr } = await admin
    .from("referrals")
    .update({
      status: "paid",
      first_payment_at: new Date().toISOString(),
      credit_awarded_brl: REFERRAL_CREDIT_BRL,
      updated_at: new Date().toISOString(),
    })
    .eq("id", refRow.id)
    .eq("status", "pending");
  if (upErr) { console.error("referral update error:", upErr); return; }

  await admin.from("user_wallet").upsert({ user_id: refRow.referrer_id }, { onConflict: "user_id" });

  const { error: txErr } = await admin.from("coin_transactions").insert({
    user_id: refRow.referrer_id,
    amount: 0,
    type: "referral_bonus",
    reference_id: `referral-${refRow.id}`,
    metadata: { credit_brl: REFERRAL_CREDIT_BRL, referred_user_id: userId },
  });
  if (txErr && !String(txErr.message).includes("duplicate")) {
    console.error("referral tx insert error:", txErr);
  }

  const { data: w } = await admin.from("user_wallet")
    .select("referral_credits_brl").eq("user_id", refRow.referrer_id).maybeSingle();
  const current = Number(w?.referral_credits_brl ?? 0);
  await admin.from("user_wallet")
    .update({ referral_credits_brl: current + REFERRAL_CREDIT_BRL, updated_at: new Date().toISOString() })
    .eq("user_id", refRow.referrer_id);

  console.log(`Referral paid: referrer=${refRow.referrer_id} +R$${REFERRAL_CREDIT_BRL}`);
}

// ---------- Sync subscription_state (PAYLOAD-FIRST) ----------
type SyncInput = {
  userId: string;
  status?: string;
  // Dados extraídos do payload (preferidos)
  asaasSubId?: string | null;
  asaasCustomerId?: string | null;
  cycle?: string | null;        // MONTHLY | YEARLY
  value?: number | null;
  nextDueDate?: string | null;  // ISO
  // Fallback API
  apiKey?: string;
};

async function syncSubscriptionState(admin: any, input: SyncInput) {
  const patch: Record<string, unknown> = {
    user_id: input.userId,
    updated_at: new Date().toISOString(),
  };

  if (input.status) patch.status = input.status;

  // 1) Aplica o que veio direto do payload
  if (input.asaasSubId) patch.asaas_subscription_id = input.asaasSubId;
  if (input.asaasCustomerId) patch.asaas_customer_id = input.asaasCustomerId;

  if (input.cycle === "MONTHLY") patch.plan = "monthly";
  else if (input.cycle === "YEARLY") patch.plan = "annual";
  else {
    const inferred = inferPlanFromValue(input.value ?? null);
    if (inferred) patch.plan = inferred;
  }

  if (input.nextDueDate) {
    const iso = isoDate(input.nextDueDate);
    if (iso) patch.current_period_end = iso;
  }

  // 2) Só chama API se faltar info crítica E tivermos apiKey
  const missingPeriod = !patch.current_period_end;
  const missingCustomer = !patch.asaas_customer_id;
  if (input.asaasSubId && (missingPeriod || missingCustomer) && input.apiKey) {
    const sub = await fetchSubscription(input.asaasSubId, input.apiKey);
    if (sub) {
      if (!patch.current_period_end && sub.nextDueDate) {
        const iso = isoDate(sub.nextDueDate);
        if (iso) patch.current_period_end = iso;
      }
      if (!patch.asaas_customer_id && sub.customer) patch.asaas_customer_id = sub.customer;
      if (!patch.plan) {
        if (sub.cycle === "MONTHLY") patch.plan = "monthly";
        else if (sub.cycle === "YEARLY") patch.plan = "annual";
      }
    }
  }

  // 3) Fallback final pra current_period_end (não deixa NULL se for assinatura ativa)
  if (!patch.current_period_end && (input.status === "active" || input.status === "trial")) {
    const days = patch.plan === "annual" ? 365 : 30;
    patch.current_period_end = addDaysISO(new Date(), days);
  }

  const { error } = await admin.from("subscription_state").upsert(patch, { onConflict: "user_id" });
  if (error) console.error("subscription_state upsert error:", error, patch);
  else console.log("subscription_state synced:", patch);
}

// ---------- Reverte desconto após PAYMENT_RECEIVED ----------
async function revertSubscriptionValueIfDiscounted(admin: any, userId: string, asaasSubId: string | undefined, apiKey: string) {
  if (!asaasSubId) return;
  const { data: red } = await admin
    .from("monthly_redemptions")
    .select("id, period_month, discount_brl_total, applied_at")
    .eq("user_id", userId)
    .eq("asaas_subscription_id", asaasSubId)
    .order("applied_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!red) return;
  if (Number(red.discount_brl_total ?? 0) <= 0) return;

  const { data: ss } = await admin
    .from("subscription_state")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  const fullPrice = ss?.plan === "annual" ? 397 : 47;

  try {
    const r = await fetch(`${ASAAS_BASE}/subscriptions/${asaasSubId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify({ value: fullPrice, updatePendingPayments: false }),
    });
    if (!r.ok) console.error("revert subscription value failed:", await r.text());
    else console.log(`reverted subscription ${asaasSubId} value to ${fullPrice}`);
  } catch (e) { console.error("revert error:", e); }
}

// ---------- Core processing ----------
async function processEvent(admin: any, body: any, apiKey?: string) {
  const event = body.event;

  // Resolve user a partir de payment OU subscription
  function resolvePaymentContext() {
    const p = body.payment ?? {};
    return {
      paymentId: (p.id as string | undefined) ?? undefined,
      userId: (p.externalReference as string | null) ?? null,
      asaasSubId: (p.subscription as string | undefined) ?? undefined,
      asaasCustomerId: (p.customer as string | undefined) ?? undefined,
      value: (p.value as number | undefined) ?? undefined,
      nextDueDate: (p.dueDate as string | undefined) ?? undefined,
      billingType: (p.billingType as string | undefined) ?? undefined,
      invoiceUrl: (p.invoiceUrl as string | undefined) ?? undefined,
      status: (p.status as string | undefined) ?? undefined,
    };
  }

  function resolveSubscriptionContext() {
    const s = body.subscription ?? {};
    return {
      userId: (s.externalReference as string | null) ?? null,
      asaasSubId: (s.id as string | undefined) ?? undefined,
      asaasCustomerId: (s.customer as string | undefined) ?? undefined,
      cycle: (s.cycle as string | undefined) ?? undefined,
      value: (s.value as number | undefined) ?? undefined,
      nextDueDate: (s.nextDueDate as string | undefined) ?? undefined,
      status: (s.status as string | undefined) ?? undefined,
    };
  }

  // ===== SUBSCRIPTION_CREATED / SUBSCRIPTION_UPDATED =====
  if (["SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED"].includes(event)) {
    const ctx = resolveSubscriptionContext();
    if (!ctx.userId) {
      console.warn(`${event}: sem externalReference, pulando`);
      return { userId: null };
    }
    const status = ctx.status === "ACTIVE" ? "active" : "trial";
    await syncSubscriptionState(admin, {
      userId: ctx.userId,
      status,
      asaasSubId: ctx.asaasSubId,
      asaasCustomerId: ctx.asaasCustomerId,
      cycle: ctx.cycle,
      value: ctx.value,
      nextDueDate: ctx.nextDueDate,
      apiKey,
    });
    console.log(`${event} processado para user ${ctx.userId}`);
    return { userId: ctx.userId };
  }

  // ===== PAYMENT_CREATED (Asaas gerou nova cobrança — popular next_invoice) =====
  if (event === "PAYMENT_CREATED") {
    const ctx = resolvePaymentContext();
    let userId = ctx.userId;
    if (!userId && ctx.asaasSubId && apiKey) {
      const sub = await fetchSubscription(ctx.asaasSubId, apiKey);
      userId = sub?.externalReference ?? null;
    }
    if (!userId) {
      console.warn("PAYMENT_CREATED sem userId — pulando");
      return { userId: null };
    }
    if (!ctx.paymentId) {
      console.warn("PAYMENT_CREATED sem paymentId — pulando");
      return { userId };
    }

    // Busca QR Pix se for Pix ou Undefined (cliente pode escolher Pix)
    let pixQr: { encodedImage: string; payload: string } | null = null;
    const isPixOrUndefined = !ctx.billingType || ctx.billingType === "PIX" || ctx.billingType === "UNDEFINED";
    if (isPixOrUndefined && apiKey) {
      pixQr = await fetchPixQrCode(ctx.paymentId, apiKey);
    }

    const invoice = {
      asaas_payment_id: ctx.paymentId,
      asaas_subscription_id: ctx.asaasSubId ?? null,
      value: Number(ctx.value ?? 0),
      original_value: Number(ctx.value ?? 0),
      due_date: ctx.nextDueDate ?? null,
      billing_type: ctx.billingType ?? "UNDEFINED",
      pix_qr_code: pixQr?.encodedImage ?? null,
      pix_copy_paste: pixQr?.payload ?? null,
      payment_url: ctx.invoiceUrl ?? `https://www.asaas.com/i/${ctx.paymentId}`,
      discount_applied: { coins_used: 0, credits_used_brl: 0, discount_brl: 0 },
      notifications_sent: { d3: false, d1: false, d0: false },
      is_paid: false,
      updated_at: new Date().toISOString(),
    };

    await syncSubscriptionState(admin, {
      userId,
      asaasSubId: ctx.asaasSubId,
      asaasCustomerId: ctx.asaasCustomerId,
      value: ctx.value,
      nextDueDate: ctx.nextDueDate,
      apiKey,
    });

    await setNextInvoice(admin, userId, invoice);
    console.log(`PAYMENT_CREATED: next_invoice salvo para user ${userId}, paymentId ${ctx.paymentId}`);
    return { userId };
  }

  // ===== PAYMENT_CONFIRMED / PAYMENT_RECEIVED =====
  if (["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(event)) {
    let ctx = resolvePaymentContext();
    let userId = ctx.userId;

    if (!userId && ctx.asaasSubId && apiKey) {
      const sub = await fetchSubscription(ctx.asaasSubId, apiKey);
      userId = sub?.externalReference ?? null;
    }
    if (!userId) {
      console.error("No user_id found in webhook payload");
      return { userId: null };
    }

    console.log("Activating premium for user:", userId);

    const { error } = await admin.from("user_usage").update({ is_premium: true }).eq("user_id", userId);
    if (error?.code === "PGRST116") {
      await admin.from("user_usage").insert({ user_id: userId, is_premium: true });
    }

    await syncSubscriptionState(admin, {
      userId,
      status: "active",
      asaasSubId: ctx.asaasSubId,
      asaasCustomerId: ctx.asaasCustomerId,
      value: ctx.value,
      nextDueDate: ctx.nextDueDate,
      apiKey,
    });

    await processReferralPayment(admin, userId);
    if (apiKey) await revertSubscriptionValueIfDiscounted(admin, userId, ctx.asaasSubId, apiKey);

    // Limpa fatura pendente: ela foi paga
    await clearNextInvoice(admin, userId);

    console.log("Premium activated successfully for:", userId);
    return { userId };
  }

  // ===== PAYMENT_OVERDUE / REFUNDED / DELETED =====
  if (["PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_DELETED"].includes(event)) {
    const ctx = resolvePaymentContext();
    let userId = ctx.userId;
    if (!userId && ctx.asaasSubId && apiKey) {
      const sub = await fetchSubscription(ctx.asaasSubId, apiKey);
      userId = sub?.externalReference ?? null;
    }
    if (userId) {
      console.log(`Deactivating premium for user (${event}):`, userId);
      // PAYMENT_OVERDUE: mantém next_invoice (cliente ainda pode pagar). Outros: limpa.
      if (event !== "PAYMENT_OVERDUE") {
        await clearNextInvoice(admin, userId);
      }
      await admin.from("user_usage").update({ is_premium: false }).eq("user_id", userId);
      await syncSubscriptionState(admin, {
        userId,
        status: "past_due",
        asaasSubId: ctx.asaasSubId,
        asaasCustomerId: ctx.asaasCustomerId,
        apiKey,
      });
    }
    return { userId };
  }
  if (["SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVE"].includes(event)) {
    const ctx = resolveSubscriptionContext();
    if (ctx.userId) {
      console.log("Deactivating premium for user (subscription):", ctx.userId);
      await admin.from("user_usage").update({ is_premium: false }).eq("user_id", ctx.userId);
      await syncSubscriptionState(admin, {
        userId: ctx.userId,
        status: "canceled",
        asaasSubId: ctx.asaasSubId,
        asaasCustomerId: ctx.asaasCustomerId,
        cycle: ctx.cycle,
        apiKey,
      });
    }
    return { userId: ctx.userId };
  }

  console.log("Evento ignorado (sem handler):", event);
  return { userId: null };
}

// ---------- HTTP entrypoint ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get("ASAAS_API_KEY") ?? undefined;
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const rawBody = await req.json();

    // ===== MODO REPROCESS =====
    if (rawBody?.action === "reprocess") {
      const cronSecret = Deno.env.get("CRON_SECRET");
      const provided = req.headers.get("x-cron-secret");
      if (!cronSecret || provided !== cronSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const eventId = rawBody.event_id as string | undefined;
      if (!eventId) {
        return new Response(JSON.stringify({ error: "event_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: row, error } = await admin
        .from("asaas_webhook_events")
        .select("payload")
        .eq("event_id", eventId)
        .maybeSingle();
      if (error || !row) {
        return new Response(JSON.stringify({ error: "event not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const result = await processEvent(admin, row.payload, apiKey);
        await markProcessed(admin, eventId);
        return new Response(JSON.stringify({ reprocessed: true, ...result }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        await markProcessed(admin, eventId, String(e?.message ?? e));
        throw e;
      }
    }

    // ===== MODO WEBHOOK NORMAL =====
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const receivedToken = req.headers.get("asaas-access-token");
    if (webhookToken && receivedToken !== webhookToken) {
      console.error("Invalid webhook token");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = rawBody.event;
    console.log("Asaas webhook received:", event, "id:", rawBody.id);

    // 1) LOG-FIRST (idempotência)
    const { alreadyProcessed } = await logWebhookEvent(admin, rawBody, null);
    if (alreadyProcessed) {
      console.log("Evento já processado, retornando 200:", rawBody.id);
      return new Response(JSON.stringify({ received: true, deduped: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) PROCESSA
    let processingError: string | undefined;
    let result: { userId: string | null } = { userId: null };
    try {
      result = await processEvent(admin, rawBody, apiKey);
    } catch (e: any) {
      processingError = String(e?.message ?? e);
      console.error("processEvent error:", e);
    }

    // 3) MARCA processado + atualiza user_id se descobrimos
    await markProcessed(admin, rawBody.id, processingError);
    if (result.userId && rawBody.id) {
      await admin
        .from("asaas_webhook_events")
        .update({ user_id: result.userId })
        .eq("event_id", rawBody.id);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
