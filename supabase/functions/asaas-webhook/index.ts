import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";
const REFERRAL_CREDIT_BRL = 10;

async function fetchSubscription(asaasSubId: string, apiKey: string) {
  const res = await fetch(`${ASAAS_BASE}/subscriptions/${asaasSubId}`, {
    headers: { access_token: apiKey },
  });
  return res.ok ? await res.json() : null;
}

async function processReferralPayment(admin: any, userId: string) {
  // Idempotente: só processa se status='pending'
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

  // Garante wallet do referrer
  await admin.from("user_wallet").upsert({ user_id: refRow.referrer_id }, { onConflict: "user_id" });

  // Loga transação (idempotente via reference_id único)
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

  // Credita BRL no wallet
  const { data: w } = await admin.from("user_wallet")
    .select("referral_credits_brl").eq("user_id", refRow.referrer_id).maybeSingle();
  const current = Number(w?.referral_credits_brl ?? 0);
  await admin.from("user_wallet")
    .update({ referral_credits_brl: current + REFERRAL_CREDIT_BRL, updated_at: new Date().toISOString() })
    .eq("user_id", refRow.referrer_id);

  console.log(`Referral paid: referrer=${refRow.referrer_id} +R$${REFERRAL_CREDIT_BRL}`);
}

async function syncSubscriptionState(admin: any, userId: string, status: string, asaasSubId?: string, apiKey?: string) {
  const patch: Record<string, unknown> = { user_id: userId, status, updated_at: new Date().toISOString() };

  if (asaasSubId) {
    patch.asaas_subscription_id = asaasSubId;
    if (apiKey) {
      const sub = await fetchSubscription(asaasSubId, apiKey);
      if (sub?.nextDueDate) patch.current_period_end = new Date(sub.nextDueDate).toISOString();
      if (sub?.customer) patch.asaas_customer_id = sub.customer;
      if (sub?.cycle === "MONTHLY") patch.plan = "monthly";
      else if (sub?.cycle === "YEARLY") patch.plan = "annual";
    }
  }

  await admin.from("subscription_state").upsert(patch, { onConflict: "user_id" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const receivedToken = req.headers.get("asaas-access-token");
  if (webhookToken && receivedToken !== webhookToken) {
    console.error("Invalid webhook token");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const event = body.event;
    const apiKey = Deno.env.get("ASAAS_API_KEY") ?? undefined;

    console.log("Asaas webhook received:", event, JSON.stringify(body).slice(0, 500));

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    async function resolveUserIdFromPayment(): Promise<{ userId: string | null; asaasSubId?: string }> {
      let userId: string | null = body.payment?.externalReference ?? null;
      const asaasSubId: string | undefined = body.payment?.subscription;
      if (!userId && asaasSubId && apiKey) {
        const sub = await fetchSubscription(asaasSubId, apiKey);
        userId = sub?.externalReference ?? null;
      }
      return { userId, asaasSubId };
    }

    if (["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(event)) {
      const { userId, asaasSubId } = await resolveUserIdFromPayment();
      if (!userId) {
        console.error("No user_id found in webhook payload");
        return new Response(JSON.stringify({ error: "No user reference" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log("Activating premium for user:", userId);

      const { error } = await admin.from("user_usage").update({ is_premium: true }).eq("user_id", userId);
      if (error?.code === "PGRST116") {
        await admin.from("user_usage").insert({ user_id: userId, is_premium: true });
      }

      await syncSubscriptionState(admin, userId, "active", asaasSubId, apiKey);
      await processReferralPayment(admin, userId);

      console.log("Premium activated successfully for:", userId);
    }

    if (["PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_DELETED"].includes(event)) {
      const { userId, asaasSubId } = await resolveUserIdFromPayment();
      if (userId) {
        console.log(`Deactivating premium for user (${event}):`, userId);
        await admin.from("user_usage").update({ is_premium: false }).eq("user_id", userId);
        await syncSubscriptionState(admin, userId, "past_due", asaasSubId, apiKey);
      }
    }

    if (["SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVE"].includes(event)) {
      const userId = body.subscription?.externalReference;
      const asaasSubId = body.subscription?.id;
      if (userId) {
        console.log("Deactivating premium for user (subscription):", userId);
        await admin.from("user_usage").update({ is_premium: false }).eq("user_id", userId);
        await syncSubscriptionState(admin, userId, "canceled", asaasSubId, apiKey);
      }
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
