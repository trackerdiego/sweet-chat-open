import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URL = "https://api.asaas.com/v3";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function asaas(path: string, init: RequestInit, key: string) {
  return fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: key,
      ...(init.headers || {}),
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Token inválido" }, 401);
    const userId = user.id;

    const body = await req.json();
    const {
      name, email, cpfCnpj, phone, postalCode, address, addressNumber,
      complement, province, plan,
      paymentMethod, // "PIX" | "CREDIT_CARD"
      creditCard,    // { holderName, number, expiryMonth, expiryYear, ccv }
    } = body;

    if (!name || !email || !cpfCnpj) return json({ error: "name, email e cpfCnpj são obrigatórios" }, 400);
    const billingType: "PIX" | "CREDIT_CARD" = paymentMethod === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX";

    // 1) Customer
    const customerBody: Record<string, string> = { name, email, cpfCnpj };
    if (phone) { customerBody.mobilePhone = phone; customerBody.phone = phone; }
    if (postalCode) customerBody.postalCode = postalCode;
    if (address) customerBody.address = address;
    if (addressNumber) customerBody.addressNumber = addressNumber;
    if (complement) customerBody.complement = complement;
    if (province) customerBody.province = province;

    const customerRes = await asaas("/customers", { method: "POST", body: JSON.stringify(customerBody) }, ASAAS_API_KEY);
    const customerData = await customerRes.json();
    if (!customerRes.ok) {
      if (customerData.errors?.some((e: any) => e.code === "invalid_cpfCnpj" || e.description?.includes("já cadastrado"))) {
        const sr = await asaas(`/customers?cpfCnpj=${cpfCnpj}`, { method: "GET" }, ASAAS_API_KEY);
        const sd = await sr.json();
        if (sd.data?.length > 0) customerData.id = sd.data[0].id;
        else return json({ error: "Erro ao criar cliente. Verifique seus dados." }, 400);
      } else {
        return json({ error: customerData.errors?.[0]?.description || "Erro ao criar cliente" }, 400);
      }
    }
    const customerId = customerData.id;

    // 2) Subscription
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const dueDateStr = nextDueDate.toISOString().split("T")[0];
    const value = plan === "yearly" ? 297.0 : 47.0;

    const remoteIp = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "127.0.0.1";

    const subBody: Record<string, unknown> = {
      customer: customerId,
      billingType,
      value,
      nextDueDate: dueDateStr,
      cycle: plan === "yearly" ? "YEARLY" : "MONTHLY",
      description: plan === "yearly" ? "Vyral Lab Pro - Assinatura Anual" : "Vyral Lab Pro - Assinatura Mensal",
      externalReference: userId,
    };

    if (billingType === "CREDIT_CARD") {
      if (!creditCard?.number || !creditCard?.holderName || !creditCard?.expiryMonth || !creditCard?.expiryYear || !creditCard?.ccv) {
        return json({ error: "Dados do cartão incompletos" }, 400);
      }
      subBody.creditCard = {
        holderName: creditCard.holderName,
        number: String(creditCard.number).replace(/\s/g, ""),
        expiryMonth: String(creditCard.expiryMonth).padStart(2, "0"),
        expiryYear: String(creditCard.expiryYear).length === 2 ? `20${creditCard.expiryYear}` : String(creditCard.expiryYear),
        ccv: String(creditCard.ccv),
      };
      subBody.creditCardHolderInfo = {
        name, email, cpfCnpj,
        postalCode: postalCode || "",
        addressNumber: addressNumber || "",
        addressComplement: complement || undefined,
        phone: phone || undefined,
        mobilePhone: phone || undefined,
      };
      subBody.remoteIp = remoteIp;
    }

    const subRes = await asaas("/subscriptions", { method: "POST", body: JSON.stringify(subBody) }, ASAAS_API_KEY);
    const subData = await subRes.json();
    if (!subRes.ok) {
      console.error("Asaas subscription error:", subData);
      return json({ error: subData.errors?.[0]?.description || "Erro ao processar pagamento" }, 400);
    }

    // Espelha em subscription_state
    try {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await admin.from("subscription_state").upsert({
        user_id: userId,
        asaas_subscription_id: subData.id,
        asaas_customer_id: customerId,
        plan: plan === "yearly" ? "annual" : "monthly",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    } catch (e) { console.warn("subscription_state upsert failed:", e); }

    // 3) Buscar primeira cobrança
    let paymentId: string | null = null;
    let paymentStatus: string | null = null;
    let invoiceUrl: string | null = null;
    try {
      const payRes = await asaas(`/subscriptions/${subData.id}/payments?limit=1`, { method: "GET" }, ASAAS_API_KEY);
      const payList = await payRes.json();
      const first = payList?.data?.[0];
      if (first) {
        paymentId = first.id;
        paymentStatus = first.status;
        invoiceUrl = first.invoiceUrl || null;
      }
    } catch (e) { console.warn("fetch first payment failed:", e); }

    if (billingType === "PIX" && paymentId) {
      try {
        const qrRes = await asaas(`/payments/${paymentId}/pixQrCode`, { method: "GET" }, ASAAS_API_KEY);
        const qr = await qrRes.json();
        if (qrRes.ok) {
          return json({
            subscriptionId: subData.id,
            paymentId,
            paymentMethod: "PIX",
            pix: {
              encodedImage: qr.encodedImage,
              payload: qr.payload,
              expirationDate: qr.expirationDate,
            },
            invoiceUrl,
          });
        }
      } catch (e) { console.warn("pixQrCode failed:", e); }
      return json({ subscriptionId: subData.id, paymentId, paymentMethod: "PIX", invoiceUrl, error: "Não foi possível gerar QR. Use o link." });
    }

    // CREDIT_CARD
    return json({
      subscriptionId: subData.id,
      paymentId,
      paymentMethod: "CREDIT_CARD",
      paymentStatus,
      invoiceUrl,
    });
  } catch (error) {
    console.error("Subscription error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
