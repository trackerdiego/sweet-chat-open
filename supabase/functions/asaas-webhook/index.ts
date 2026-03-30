import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate webhook token
  const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const receivedToken = req.headers.get("asaas-access-token");
  if (webhookToken && receivedToken !== webhookToken) {
    console.error("Invalid webhook token");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const event = body.event;

    console.log("Asaas webhook received:", event, JSON.stringify(body).slice(0, 500));

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // For payment events, get the user_id from externalReference
    if (["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(event)) {
      let userId = body.payment?.externalReference;

      // If no externalReference on payment, try fetching from subscription
      if (!userId && body.payment?.subscription) {
        const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
        if (ASAAS_API_KEY) {
          const subRes = await fetch(`https://api.asaas.com/v3/subscriptions/${body.payment.subscription}`, {
            headers: { access_token: ASAAS_API_KEY },
          });
          const subData = await subRes.json();
          userId = subData.externalReference;
        }
      }

      if (!userId) {
        console.error("No user_id found in webhook payload");
        return new Response(JSON.stringify({ error: "No user reference" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log("Activating premium for user:", userId);

      const { error } = await supabaseAdmin
        .from("user_usage")
        .update({ is_premium: true })
        .eq("user_id", userId);

      if (error) {
        console.error("Error activating premium:", error);
        // If no row exists yet, insert one
        if (error.code === "PGRST116") {
          await supabaseAdmin.from("user_usage").insert({ user_id: userId, is_premium: true });
        }
      }

      console.log("Premium activated successfully for:", userId);
    }

    // Handle subscription cancellation/deletion
    if (["SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVE"].includes(event)) {
      const userId = body.subscription?.externalReference;
      if (userId) {
        console.log("Deactivating premium for user:", userId);
        await supabaseAdmin
          .from("user_usage")
          .update({ is_premium: false })
          .eq("user_id", userId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 200, // Return 200 to avoid Asaas retries
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
