import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "agentevendeagente@gmail.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");

    if (!cronSecret) {
      return new Response(JSON.stringify({ error: "CRON_SECRET não configurado no servidor" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user || user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_id } = await req.json();
    if (!event_id || typeof event_id !== "string") {
      return new Response(JSON.stringify({ error: "event_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Proxy para o webhook em modo reprocess
    const webhookUrl = `${supabaseUrl}/functions/v1/asaas-webhook`;
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
      body: JSON.stringify({ action: "reprocess", event_id }),
    });

    const text = await upstream.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep raw */ }

    return new Response(JSON.stringify({
      upstream_status: upstream.status,
      upstream_body: parsed,
    }), {
      status: upstream.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-reprocess-asaas-event error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
