// get-ai-job-status
// Endpoint único de polling pra todos os jobs assíncronos (tools, script, daily_guide, transcription).
// Sempre responde em <1s. Frontend faz polling a cada 2s.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/ai-job-runner.ts";

const FUNCTION_VERSION = "2026-04-28-async-status";
console.log(`[get-ai-job-status] boot v=${FUNCTION_VERSION}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Não autorizado" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: "Não autorizado" }, 401);

    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId");
    if (!jobId) return jsonResponse({ error: "jobId é obrigatório" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await admin.from("ai_jobs")
      .select("id, job_type, status, result, error_message, attempts, model_used, created_at, started_at, completed_at")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return jsonResponse({ error: error.message }, 500);
    if (!data) return jsonResponse({ error: "Job não encontrado" }, 404);

    return jsonResponse({ job: data });
  } catch (e) {
    console.error("[get-ai-job-status] error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
