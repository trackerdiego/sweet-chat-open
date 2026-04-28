// Retorna a fatura Pix pendente do usuário, aplicando coins/créditos automaticamente
// se houver saldo (idempotente via monthly_redemptions(user_id, period_month)).
// Chamada pela tela /renovar.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE = "https://api.asaas.com/v3";
const COIN_TO_BRL = 0.01;
const MONTHLY_DISCOUNT_CAP_PCT = 0.5;

function periodMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function fetchPixQrCode(paymentId: string, apiKey: string) {
  try {
    const res = await fetch(`${ASAAS_BASE}/payments/${paymentId}/pixQrCode`, {
      headers: { access_token: apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { encodedImage: data.encodedImage ?? "", payload: data.payload ?? "" };
  } catch (e) {
    console.error("fetchPixQrCode error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Lê subscription_state
    const { data: sub } = await admin
      .from("subscription_state")
      .select("plan, status, asaas_subscription_id, next_invoice")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub?.next_invoice) {
      return new Response(JSON.stringify({ invoice: null, message: "Nenhuma fatura pendente" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let invoice = sub.next_invoice as Record<string, any>;
    const paymentId = invoice.asaas_payment_id as string;
    if (!paymentId) {
      return new Response(JSON.stringify({ invoice, message: "Fatura sem paymentId" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Verifica se ainda tem coins/créditos pra aplicar (mensal apenas)
    const period = invoice.due_date
      ? periodMonth(new Date(invoice.due_date))
      : periodMonth(new Date());

    const alreadyApplied = Number(invoice.discount_applied?.discount_brl ?? 0) > 0;
    const isMonthly = sub.plan === "monthly" || sub.plan === null;

    if (isMonthly && !alreadyApplied) {
      // Idempotência via monthly_redemptions
      const { data: existing } = await admin
        .from("monthly_redemptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("period_month", period)
        .maybeSingle();

      if (!existing) {
        const { data: wallet } = await admin
          .from("user_wallet")
          .select("coins_balance, referral_credits_brl")
          .eq("user_id", user.id)
          .maybeSingle();

        const coins = wallet?.coins_balance ?? 0;
        const credits = Number(wallet?.referral_credits_brl ?? 0);
        const totalBrlAvailable = coins * COIN_TO_BRL + credits;

        if (totalBrlAvailable > 0) {
          const fullPrice = Number(invoice.original_value ?? invoice.value ?? 0);
          const maxDiscount = Math.min(fullPrice * MONTHLY_DISCOUNT_CAP_PCT, fullPrice - 1);
          const discount = Math.min(totalBrlAvailable, Math.max(0, maxDiscount));

          if (discount > 0) {
            const creditsUsed = Math.min(credits, discount);
            const remaining = discount - creditsUsed;
            let coinsUsed = Math.ceil(remaining / COIN_TO_BRL);
            if (coinsUsed > coins) coinsUsed = coins;
            const effectiveDiscount = Number((creditsUsed + coinsUsed * COIN_TO_BRL).toFixed(2));
            const newValue = Number((fullPrice - effectiveDiscount).toFixed(2));

            // PATCH na fatura específica (não na subscription — só essa cobrança)
            const patchRes = await fetch(`${ASAAS_BASE}/payments/${paymentId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
              body: JSON.stringify({ value: newValue }),
            });

            if (patchRes.ok) {
              // Registra redemption
              await admin.from("monthly_redemptions").insert({
                user_id: user.id,
                period_month: period,
                coins_used: coinsUsed,
                credits_used_brl: creditsUsed,
                discount_brl_total: effectiveDiscount,
                asaas_subscription_id: sub.asaas_subscription_id,
              });

              // Debita wallet
              await admin.from("user_wallet").update({
                coins_balance: coins - coinsUsed,
                referral_credits_brl: Number((credits - creditsUsed).toFixed(2)),
                updated_at: new Date().toISOString(),
              }).eq("user_id", user.id);

              if (coinsUsed > 0) {
                await admin.from("coin_transactions").insert({
                  user_id: user.id,
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
                    source: "renew_page",
                  },
                });
              }

              // Re-busca QR Pix com novo valor
              const newQr = await fetchPixQrCode(paymentId, ASAAS_API_KEY);

              invoice = {
                ...invoice,
                value: newValue,
                pix_qr_code: newQr?.encodedImage ?? invoice.pix_qr_code,
                pix_copy_paste: newQr?.payload ?? invoice.pix_copy_paste,
                discount_applied: {
                  coins_used: coinsUsed,
                  credits_used_brl: creditsUsed,
                  discount_brl: effectiveDiscount,
                },
                updated_at: new Date().toISOString(),
              };

              await admin.from("subscription_state")
                .update({ next_invoice: invoice, updated_at: new Date().toISOString() })
                .eq("user_id", user.id);

              console.log(`Discount applied via renew page: user=${user.id} discount=R$${effectiveDiscount}`);
            } else {
              console.error("PATCH payment failed:", await patchRes.text());
            }
          }
        }
      }
    }

    // 3) Sempre re-busca QR Pix se faltar (cobrança Pix pode não ter QR salvo ainda)
    if (!invoice.pix_qr_code && paymentId) {
      const qr = await fetchPixQrCode(paymentId, ASAAS_API_KEY);
      if (qr) {
        invoice = { ...invoice, pix_qr_code: qr.encodedImage, pix_copy_paste: qr.payload };
        await admin.from("subscription_state")
          .update({ next_invoice: invoice, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
      }
    }

    return new Response(JSON.stringify({ invoice }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-pending-invoice error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
