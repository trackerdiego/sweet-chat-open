import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URL = "https://api.asaas.com/v3";

// Tabela de juros do plano anual (em %, acréscimo TOTAL sobre R$297).
// Default: SEM JUROS até 12x (lojista absorve a taxa Asaas).
// Para repassar juros, ajuste aqui (e mantenha igual em src/lib/installments.ts).
const YEARLY_INTEREST_PCT: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
  7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
};
const MAX_INSTALLMENTS = 12;
const YEARLY_BASE_PRICE = 297.0;

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

function calcInstallment(n: number, basePrice = YEARLY_BASE_PRICE) {
  const inst = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(n || 1)));
  const pct = YEARLY_INTEREST_PCT[inst] ?? 0;
  const total = +(basePrice * (1 + pct / 100)).toFixed(2);
  return { installments: inst, total, interestPct: pct };
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
      installmentCount, // só plano anual + cartão (1-12)
    } = body;

    const yearlyPrice = YEARLY_BASE_PRICE;

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

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const dueDateStr = nextDueDate.toISOString().split("T")[0];
    const remoteIp = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "127.0.0.1";

    // ===== FLUXO ESPECIAL: anual + cartão + parceladas (>1x) =====
    const wantsInstallment =
      plan === "yearly" &&
      billingType === "CREDIT_CARD" &&
      Number(installmentCount) > 1;

    if (wantsInstallment) {
      if (!creditCard?.number || !creditCard?.holderName || !creditCard?.expiryMonth || !creditCard?.expiryYear || !creditCard?.ccv) {
        return json({ error: "Dados do cartão incompletos" }, 400);
      }
      const calc = calcInstallment(Number(installmentCount), yearlyPrice);

      const ccPayload = {
        holderName: creditCard.holderName,
        number: String(creditCard.number).replace(/\s/g, ""),
        expiryMonth: String(creditCard.expiryMonth).padStart(2, "0"),
        expiryYear: String(creditCard.expiryYear).length === 2 ? `20${creditCard.expiryYear}` : String(creditCard.expiryYear),
        ccv: String(creditCard.ccv),
      };
      const ccHolderInfo = {
        name, email, cpfCnpj,
        postalCode: postalCode || "",
        addressNumber: addressNumber || "",
        addressComplement: complement || undefined,
        phone: phone || undefined,
        mobilePhone: phone || undefined,
      };

      // 1ª etapa: cobrança parcelada via /payments
      const payBody: Record<string, unknown> = {
        customer: customerId,
        billingType: "CREDIT_CARD",
        dueDate: dueDateStr,
        totalValue: calc.total,
        installmentCount: calc.installments,
        description: `Vyral Lab Pro - Assinatura Anual (${calc.installments}x)`,
        externalReference: userId,
        creditCard: ccPayload,
        creditCardHolderInfo: ccHolderInfo,
        remoteIp,
      };

      const payRes = await asaas("/payments", { method: "POST", body: JSON.stringify(payBody) }, ASAAS_API_KEY);
      const payData = await payRes.json();
      if (!payRes.ok) {
        console.error("Asaas installment payment error:", payData);
        return json({ error: payData.errors?.[0]?.description || "Erro ao processar pagamento parcelado" }, 400);
      }

      const ccToken = payData?.creditCard?.creditCardToken ?? null;
      const installmentId = payData?.installment ?? payData?.id ?? null;

      // 2ª etapa: subscription para renovação em +365d com token tokenizado
      let subData: any = null;
      try {
        const renewDate = new Date();
        renewDate.setDate(renewDate.getDate() + 365);
        const renewStr = renewDate.toISOString().split("T")[0];

        const subBody: Record<string, unknown> = {
          customer: customerId,
          billingType: "CREDIT_CARD",
          value: yearlyPrice,
          nextDueDate: renewStr,
          cycle: "YEARLY",
          description: `Vyral Lab Pro - Renovação Anual`,
          externalReference: userId,
          creditCardHolderInfo: ccHolderInfo,
          remoteIp,
        };
        if (ccToken) {
          subBody.creditCardToken = ccToken;
        } else {
          subBody.creditCard = ccPayload;
        }

        const subRes = await asaas("/subscriptions", { method: "POST", body: JSON.stringify(subBody) }, ASAAS_API_KEY);
        subData = await subRes.json();
        if (!subRes.ok) {
          console.warn("renewal subscription failed (continuing):", subData);
          subData = null;
        }
      } catch (e) {
        console.warn("renewal subscription exception:", e);
      }

      // Espelha em subscription_state
      try {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await admin.from("subscription_state").upsert({
          user_id: userId,
          asaas_subscription_id: subData?.id ?? null,
          asaas_customer_id: customerId,
          plan: "annual",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      } catch (e) { console.warn("subscription_state upsert failed:", e); }

      return json({
        subscriptionId: subData?.id ?? null,
        installmentId,
        paymentId: payData?.id ?? null,
        paymentMethod: "CREDIT_CARD",
        paymentStatus: payData?.status ?? null,
        invoiceUrl: payData?.invoiceUrl ?? null,
        installmentCount: calc.installments,
        installmentValue: +(calc.total / calc.installments).toFixed(2),
        totalValue: calc.total,
        interestApplied: calc.interestPct > 0,
      });
    }

    // ===== FLUXO PADRÃO: subscription (PIX, mensal ou anual 1x) =====
    const value = plan === "yearly" ? yearlyPrice : 47.0;

    const subBody: Record<string, unknown> = {
      customer: customerId,
      billingType,
      value,
      nextDueDate: dueDateStr,
      cycle: plan === "yearly" ? "YEARLY" : "MONTHLY",
      description: `${plan === "yearly" ? "Vyral Lab Pro - Assinatura Anual" : "Vyral Lab Pro - Assinatura Mensal"}`,
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
