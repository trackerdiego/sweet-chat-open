import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      throw new Error("ASAAS_API_KEY is not configured");
    }

    const { name, email, cpfCnpj, phone, postalCode, address, addressNumber, complement, province, plan } = await req.json();

    if (!name || !email || !cpfCnpj) {
      return new Response(
        JSON.stringify({ error: "name, email e cpfCnpj são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ASAAS_BASE_URL = "https://api.asaas.com/v3";

    console.log("Creating customer in Asaas...");
    const customerBody: Record<string, string> = { name, email, cpfCnpj };
    if (phone) { customerBody.mobilePhone = phone; customerBody.phone = phone; }
    if (postalCode) customerBody.postalCode = postalCode;
    if (address) customerBody.address = address;
    if (addressNumber) customerBody.addressNumber = addressNumber;
    if (complement) customerBody.complement = complement;
    if (province) customerBody.province = province;

    const customerResponse = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
      body: JSON.stringify(customerBody),
    });

    const customerData = await customerResponse.json();
    
    if (!customerResponse.ok) {
      if (customerData.errors?.some((e: any) => e.code === "invalid_cpfCnpj" || e.description?.includes("já cadastrado"))) {
        const searchResponse = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${cpfCnpj}`, { headers: { access_token: ASAAS_API_KEY } });
        const searchData = await searchResponse.json();
        if (searchData.data?.length > 0) { customerData.id = searchData.data[0].id; }
        else { return new Response(JSON.stringify({ error: "Erro ao criar cliente. Verifique seus dados." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
      } else {
        return new Response(JSON.stringify({ error: customerData.errors?.[0]?.description || "Erro ao criar cliente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const customerId = customerData.id;

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const dueDateStr = nextDueDate.toISOString().split("T")[0];

    const subscriptionResponse = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
      body: JSON.stringify({
        customer: customerId, billingType: "UNDEFINED",
        value: plan === "yearly" ? 397.0 : 47.0, nextDueDate: dueDateStr,
        cycle: plan === "yearly" ? "YEARLY" : "MONTHLY",
        description: plan === "yearly" ? "InfluLab Pro - Assinatura Anual" : "InfluLab Pro - Assinatura Mensal",
      }),
    });

    const subscriptionData = await subscriptionResponse.json();
    if (!subscriptionResponse.ok) {
      return new Response(JSON.stringify({ error: subscriptionData.errors?.[0]?.description || "Erro ao criar assinatura" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const invoiceUrl = subscriptionData.paymentLink || `https://www.asaas.com/c/${subscriptionData.id}`;

    return new Response(JSON.stringify({ subscriptionId: subscriptionData.id, paymentUrl: invoiceUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Subscription error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
