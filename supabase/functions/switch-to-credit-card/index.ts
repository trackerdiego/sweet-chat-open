// Gera nova cobrança no cartão pra fatura pendente do usuário.
// Mantém a subscription Asaas (continua igual, só essa cobrança vira CREDIT_CARD).
// Retorna invoiceUrl pro cliente cadastrar cartão na página segura do Asaas.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

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

    const { data: sub } = await admin
      .from("subscription_state")
      .select("next_invoice, asaas_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub?.next_invoice) {
      return new Response(JSON.stringify({ error: "Sem fatura pendente" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invoice = sub.next_invoice as Record<string, any>;
    const paymentId = invoice.asaas_payment_id as string;
    if (!paymentId) {
      return new Response(JSON.stringify({ error: "Fatura sem paymentId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH no payment existente: troca billingType pra CREDIT_CARD
    const patchRes = await fetch(`${ASAAS_BASE}/payments/${paymentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
      body: JSON.stringify({ billingType: "CREDIT_CARD" }),
    });

    if (!patchRes.ok) {
      const err = await patchRes.text();
      console.error("PATCH payment to CREDIT_CARD failed:", err);
      return new Response(JSON.stringify({ error: "Erro ao trocar para cartão", detail: err }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updated = await patchRes.json();
    const checkoutUrl = updated.invoiceUrl ?? `https://www.asaas.com/i/${paymentId}`;

    // Atualiza next_invoice
    const newInvoice = {
      ...invoice,
      billing_type: "CREDIT_CARD",
      payment_url: checkoutUrl,
      pix_qr_code: null,
      pix_copy_paste: null,
      updated_at: new Date().toISOString(),
    };
    await admin.from("subscription_state")
      .update({ next_invoice: newInvoice, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ checkoutUrl, invoice: newInvoice }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("switch-to-credit-card error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
