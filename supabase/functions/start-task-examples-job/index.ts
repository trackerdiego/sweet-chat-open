// start-task-examples-job
// Cria job assíncrono pra gerar APENAS o objeto `taskExamples` (5 exemplos por
// chave de tarefa do DailySchedule), sem regenerar hooks/CTAs/storytelling.
// Mais barato e rápido que start-daily-guide-job; NÃO consome cota tool_generations.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiNative, GeminiError } from "../_shared/gemini.ts";
import { corsHeaders, jsonResponse, enqueueJob, runInBackground, JobError } from "../_shared/ai-job-runner.ts";

const FUNCTION_VERSION = "2026-05-16-task-examples-only";
console.log(`[start-task-examples-job] boot v=${FUNCTION_VERSION}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json() as Record<string, unknown>;

    const result = await enqueueJob({ req, jobType: "task_examples", payload });
    if (result instanceof Response) return result;
    const { jobId, userId, userClient, admin } = result;

    runInBackground(admin, jobId, async () => {
      const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
      if (!GOOGLE_GEMINI_API_KEY) throw new JobError("Configuração do servidor incompleta (chave da IA ausente).");

      // Rate-limit leve por usuário: máximo 6 chamadas/dia (não conta cota oficial).
      const today = new Date().toISOString().split("T")[0];
      const { count } = await admin
        .from("usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("feature", "task_examples")
        .gte("created_at", `${today}T00:00:00.000Z`);
      if ((count ?? 0) >= 6) {
        throw new JobError("Você já diversificou as sugestões 6x hoje. Tente novamente amanhã.");
      }

      const audienceRes = await userClient
        .from("audience_profiles")
        .select("avatar_profile")
        .eq("user_id", userId)
        .maybeSingle();
      const audienceData = audienceRes.data as { avatar_profile?: Record<string, unknown> } | null;

      const pillar = (payload.pillar as string) || "";
      const pillarLabel = (payload.pillarLabel as string) || "";
      const weeklyTheme = (payload.weeklyTheme as string) || "";
      const dayTitle = (payload.dayTitle as string) || "";
      const day = payload.day;
      const primaryNiche = (payload.primaryNiche as string) || "lifestyle";
      const contentStyle = (payload.contentStyle as string) || "casual";

      let visceralContext = "";
      if (audienceData?.avatar_profile) {
        const ap = audienceData.avatar_profile;
        visceralContext = `\n\nPERFIL DO PÚBLICO:\nAvatar: ${ap.avatar || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto: ${ap.deepOccultDesire || ''}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}`;
      }

      const styleMap: Record<string, string> = {
        casual: "leve, descontraído, como conversa entre amigos",
        profissional: "autoritário, informativo, com dados e dicas práticas",
        divertido: "engraçado, irreverente, usando memes e trends",
      };
      const styleDesc = styleMap[contentStyle] || styleMap.casual;

      const systemInstruction = `Você é especialista em marketing digital para criadores de conteúdo brasileiros. Use linguagem neutra de gênero.\nNicho principal: ${primaryNiche}.\nEstilo: ${styleDesc}.${visceralContext}\nGere sugestões autênticas, pessoais e que soem naturais.\nContexto do dia: pilar "${pillarLabel}", título "${dayTitle}", tema semanal "${weeklyTheme}".\nEvite repetir frases padrão; cada item deve ser SUBSTANCIALMENTE diferente.`;

      const prompt = `Para o dia ${day} (pilar ${pillarLabel}, título "${dayTitle}", nicho "${primaryNiche}"), gere o objeto taskExamples com 7 chaves:\nmorningInsight, morningPoll, reel, reelEngagement, valueStories, lifestyleStory, feedPost.\nCada chave deve ter EXATAMENTE 5 exemplos PRÁTICOS, prontos para uso, diferentes entre si, no nicho "${primaryNiche}". Seed de variação: dia ${day} — use isso pra garantir que sugestões deste dia sejam DIFERENTES dos dias vizinhos.`;

      const schema = {
        type: "object",
        properties: {
          morningInsight: { type: "array", items: { type: "string" } },
          morningPoll: { type: "array", items: { type: "string" } },
          reel: { type: "array", items: { type: "string" } },
          reelEngagement: { type: "array", items: { type: "string" } },
          valueStories: { type: "array", items: { type: "string" } },
          lifestyleStory: { type: "array", items: { type: "string" } },
          feedPost: { type: "array", items: { type: "string" } },
        },
        required: ["morningInsight", "morningPoll", "reel", "reelEngagement", "valueStories", "lifestyleStory", "feedPost"],
      };

      const startedAt = Date.now();
      let res: Awaited<ReturnType<typeof callGeminiNative>>;
      try {
        res = await callGeminiNative({
          apiKey: GOOGLE_GEMINI_API_KEY,
          systemInstruction,
          prompt,
          schema,
          tag: "task-examples",
          model: "gemini-2.5-flash",
          midModel: "gemini-2.5-flash-lite",
          fallbackModel: "gemini-2.5-pro",
          maxOutputTokens: 2200,
          timeoutMs: 45000,
          midTimeoutMs: 35000,
          fallbackTimeoutMs: 60000,
          primaryAttempts: 2,
          midAttempts: 2,
          fallbackAttempts: 1,
        });
      } catch (e) {
        if (e instanceof GeminiError) {
          if (e.status === 429) throw new JobError("Muitas requisições à IA. Aguarde alguns segundos.");
          if (e.status === 402) throw new JobError("Créditos da IA esgotados. Avise o administrador.");
          throw new JobError("O serviço de IA está instável agora. Tente novamente em 1-2 minutos.", e);
        }
        throw new JobError("Erro ao diversificar sugestões. Tente novamente.");
      }

      const taskExamples = res.json as Record<string, unknown>;

      // Loga uso (sem incrementar tool_generations)
      try {
        await admin.from("usage_logs").insert({ user_id: userId, feature: "task_examples" });
      } catch (e) {
        console.warn(`[start-task-examples-job] usage_logs insert failed for job ${jobId}`, e);
      }

      console.log(`[start-task-examples-job] job ${jobId} success`, {
        day, pillar, totalMs: Date.now() - startedAt, attempts: res.attempts, modelUsed: res.modelUsed,
      });
      return { taskExamples, __meta: { attempts: res.attempts, modelUsed: res.modelUsed } };
    });

    return jsonResponse({ jobId });
  } catch (e) {
    console.error("[start-task-examples-job] uncaught error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
