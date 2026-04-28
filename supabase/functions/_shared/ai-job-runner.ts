// Helper compartilhado pra padrão de job assíncrono em edge functions de IA.
// Toda function start-* faz: valida JWT → cria row em ai_jobs → dispara worker via
// EdgeRuntime.waitUntil → responde {jobId} em <2s. Imune a timeouts Kong/Cloudflare/Nginx.
//
// Uso típico:
//   import { enqueueJob, runInBackground } from "../_shared/ai-job-runner.ts";
//   const { jobId, admin } = await enqueueJob({ req, jobType: "tools", payload });
//   runInBackground(admin, jobId, async () => { /* trabalho pesado */ return result; });
//   return jsonResponse({ jobId });

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type AiJobType = "tools" | "script" | "daily_guide" | "transcription";

export interface EnqueueResult {
  jobId: string;
  userId: string;
  userClient: SupabaseClient;
  admin: SupabaseClient;
}

/**
 * Valida o JWT do request, cria uma row em ai_jobs com status 'pending'
 * e devolve clients prontos pro worker. NÃO dispara o worker — quem chama
 * deve invocar runInBackground em seguida.
 */
export async function enqueueJob(opts: {
  req: Request;
  jobType: AiJobType;
  payload: Record<string, unknown>;
}): Promise<EnqueueResult | Response> {
  const { req, jobType, payload } = opts;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Não autorizado" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Não autorizado" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: job, error: insertErr } = await admin
    .from("ai_jobs")
    .insert({
      user_id: user.id,
      job_type: jobType,
      status: "pending",
      input_payload: payload,
    })
    .select("id")
    .single();

  if (insertErr || !job) {
    console.error(`[ai-job-runner] failed to insert ${jobType} job`, insertErr);
    return jsonResponse({ error: "Não foi possível iniciar o job" }, 500);
  }

  return { jobId: job.id, userId: user.id, userClient, admin };
}

/**
 * Marca o job como 'processing', executa o worker, persiste resultado/erro.
 * Pra ser chamado dentro de EdgeRuntime.waitUntil() — nunca aguarda no request.
 *
 * O worker recebe (admin, jobId) e deve devolver o JSON final.
 * Em caso de erro Gemini com status conhecido, joga GeminiJobError pra
 * mensagem amigável ser persistida.
 */
export class JobError extends Error {
  constructor(public userMessage: string, public cause?: unknown) {
    super(userMessage);
  }
}

// deno-lint-ignore no-explicit-any
type EdgeRuntimeLike = { waitUntil: (p: Promise<any>) => void };

export function runInBackground(
  admin: SupabaseClient,
  jobId: string,
  worker: () => Promise<unknown>,
): void {
  const task = (async () => {
    const startedAt = new Date().toISOString();
    try {
      await admin
        .from("ai_jobs")
        .update({ status: "processing", started_at: startedAt })
        .eq("id", jobId);

      const result = await worker();

      await admin
        .from("ai_jobs")
        .update({
          status: "done",
          result: (result ?? {}) as Record<string, unknown>,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      console.log(`[ai-job-runner] job ${jobId} done`);
    } catch (e) {
      const userMessage = e instanceof JobError
        ? e.userMessage
        : e instanceof Error
        ? e.message
        : "Erro desconhecido";
      console.error(`[ai-job-runner] job ${jobId} failed:`, e);
      try {
        await admin
          .from("ai_jobs")
          .update({
            status: "failed",
            error_message: userMessage.slice(0, 500),
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      } catch (persistErr) {
        console.error(`[ai-job-runner] could not persist failure for ${jobId}`, persistErr);
      }
    }
  })();

  // EdgeRuntime.waitUntil garante execução em background sem bloquear a Response.
  // Fallback: deixa a Promise solta — Deno deploy mantém vivo enquanto pendente.
  const rt = (globalThis as unknown as { EdgeRuntime?: EdgeRuntimeLike }).EdgeRuntime;
  if (rt && typeof rt.waitUntil === "function") {
    rt.waitUntil(task);
  } else {
    task.catch((err) => console.error("[ai-job-runner] background task crashed", err));
  }
}
