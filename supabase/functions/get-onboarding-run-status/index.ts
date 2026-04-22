// get-onboarding-run-status
// Devolve o status atual de um run de onboarding. Polling do frontend a cada 2s.
// Sempre retorna em <1s.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTION_VERSION = "2026-04-22-async-status";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "x-influlab-function-version",
  "x-influlab-function-version": FUNCTION_VERSION,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const runId = url.searchParams.get("runId");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    let query = admin.from("onboarding_runs").select("id, status, current_stage, stages, error_message, created_at, completed_at").eq("user_id", user.id);
    if (runId) {
      query = query.eq("id", runId);
    } else {
      query = query.order("created_at", { ascending: false }).limit(1);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!data) {
      return new Response(JSON.stringify({ run: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Se completed, valida que matriz realmente foi salva
    let matrixValidated = false;
    if (data.status === "completed") {
      const { data: strat } = await admin.from("user_strategies").select("strategies").eq("user_id", user.id).maybeSingle();
      const arr = strat?.strategies;
      matrixValidated = Array.isArray(arr) && arr.length >= 28;
    }

    return new Response(JSON.stringify({ run: data, matrixValidated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("get-onboarding-run-status error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
