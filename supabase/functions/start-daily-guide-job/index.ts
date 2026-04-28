// start-daily-guide-job
// Cria job assíncrono pra geração do guia diário (DailyGuide.tsx).
// Faz 2 chamadas Gemini paralelas (categoria geral + taskExamples).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiNative, GeminiError } from "../_shared/gemini.ts";
import { corsHeaders, jsonResponse, enqueueJob, runInBackground, JobError } from "../_shared/ai-job-runner.ts";

const FUNCTION_VERSION = "2026-04-28-async-daily-guide";
console.log(`[start-daily-guide-job] boot v=${FUNCTION_VERSION}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json() as Record<string, unknown>;

    const result = await enqueueJob({ req, jobType: "daily_guide", payload });
    if (result instanceof Response) return result;
    const { jobId, userId, userClient, admin } = result;

    runInBackground(admin, jobId, async () => {
      const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
      if (!GOOGLE_GEMINI_API_KEY) throw new JobError("Configuração do servidor incompleta (chave da IA ausente).");

      const [usageRes, audienceRes] = await Promise.all([
        admin.from("user_usage").select("is_premium, tool_generations, last_tool_date").eq("user_id", userId).maybeSingle(),
        userClient.from("audience_profiles").select("avatar_profile").eq("user_id", userId).maybeSingle(),
      ]);
      const usageData = usageRes.data as { is_premium?: boolean; tool_generations?: number; last_tool_date?: string } | null;
      const audienceData = audienceRes.data as { avatar_profile?: Record<string, unknown> } | null;

      const isPremium = usageData?.is_premium ?? false;
      const today = new Date().toISOString().split("T")[0];
      const isNewDay = usageData?.last_tool_date !== today;
      const currentCount = isNewDay ? 0 : (usageData?.tool_generations ?? 0);
      if (!isPremium && currentCount >= 2) {
        throw new JobError("Você atingiu o limite de 2 gerações gratuitas. Assine o plano premium para uso ilimitado.");
      }

      const pillar = payload.pillar as string;
      const pillarLabel = payload.pillarLabel as string;
      const weeklyTheme = (payload.weeklyTheme as string) || "";
      const dayTitle = payload.dayTitle as string;
      const day = payload.day;
      const primaryNiche = (payload.primaryNiche as string) || "";
      const contentStyle = (payload.contentStyle as string) || "casual";
      const visceralElement = (payload.visceralElement as string) || "";

      let visceralContext = "";
      if (audienceData?.avatar_profile) {
        const ap = audienceData.avatar_profile;
        visceralContext = `\n\nPERFIL DO PÚBLICO:\nAvatar: ${ap.avatar || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto: ${ap.deepOccultDesire || ''}\nFeridas centrais: ${JSON.stringify(ap.coreWounds || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}`;
      }

      const styleMap: Record<string, string> = { casual: "leve, descontraído, como conversa entre amigos", profissional: "autoritário, informativo, com dados e dicas práticas", divertido: "engraçado, irreverente, usando memes e trends" };
      const styleDesc = styleMap[contentStyle] || styleMap.casual;
      const nicheContext = primaryNiche ? `O nicho principal do(a) criador(a) de conteúdo é: ${primaryNiche}.` : '';
      const visceralInstruction = visceralElement ? `\n\nGATILHO VISCERAL OBRIGATÓRIO PARA ESTE DIA: ${visceralElement} — base emocional dos hooks, storytelling, CTAs e cliffhangers.` : "";

      const baseSystem = `Você é especialista em marketing digital para criadores de conteúdo brasileiros. Use linguagem neutra de gênero.\n${nicheContext}\nEstilo: ${styleDesc}.${visceralContext}${visceralInstruction}\nGere conteúdo autêntico, pessoal e que soe natural.\nConteúdo é para o nicho "${pillarLabel}" no dia "${dayTitle}". Tema semanal: "${weeklyTheme}".\nAdapte TODO o conteúdo ao nicho "${primaryNiche || 'lifestyle'}".`;
      const promptA = `Gere conteúdo para o dia ${day}.\nPilar: ${pillarLabel} (${pillar})\nTítulo do dia: ${dayTitle}\nNicho: ${primaryNiche || 'lifestyle'}\n\nGere as 6 categorias (cada uma com EXATAMENTE 5 itens):\n1. contentTypes\n2. hooks\n3. videoFormats\n4. storytelling\n5. ctas\n6. cliffhangers`;
      const promptB = `Para o dia ${day} (pilar ${pillarLabel}, título "${dayTitle}", nicho "${primaryNiche || 'lifestyle'}"), gere o objeto taskExamples com 7 chaves: morningInsight, morningPoll, reel, reelEngagement, valueStories, lifestyleStory, feedPost. Cada chave deve ter um array com EXATAMENTE 5 exemplos PRÁTICOS, prontos para uso, no nicho "${primaryNiche || 'lifestyle'}".`;

      const schemaA = { type: "object", properties: {
        contentTypes: { type: "array", items: { type: "string" } },
        hooks: { type: "array", items: { type: "string" } },
        videoFormats: { type: "array", items: { type: "string" } },
        storytelling: { type: "array", items: { type: "string" } },
        ctas: { type: "array", items: { type: "string" } },
        cliffhangers: { type: "array", items: { type: "string" } },
      }, required: ["contentTypes", "hooks", "videoFormats", "storytelling", "ctas", "cliffhangers"] };
      const schemaB = { type: "object", properties: {
        morningInsight: { type: "array", items: { type: "string" } },
        morningPoll: { type: "array", items: { type: "string" } },
        reel: { type: "array", items: { type: "string" } },
        reelEngagement: { type: "array", items: { type: "string" } },
        valueStories: { type: "array", items: { type: "string" } },
        lifestyleStory: { type: "array", items: { type: "string" } },
        feedPost: { type: "array", items: { type: "string" } },
      }, required: ["morningInsight", "morningPoll", "reel", "reelEngagement", "valueStories", "lifestyleStory", "feedPost"] };

      const callAWithRetry = async () => {
        let lastErr: unknown;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            return await callGeminiNative({
              apiKey: GOOGLE_GEMINI_API_KEY, systemInstruction: baseSystem, prompt: promptA, schema: schemaA,
              tag: `daily-guide-A-try${attempt}`, maxOutputTokens: 1800, timeoutMs: 60000,
              primaryAttempts: 2, fallbackAttempts: 2,
            });
          } catch (e) {
            lastErr = e;
            const status = e instanceof GeminiError ? e.status : 0;
            if (status === 429 || status === 402) throw e;
            if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
          }
        }
        throw lastErr;
      };

      const startedAt = Date.now();
      const [resA, resB] = await Promise.allSettled([
        callAWithRetry(),
        new Promise((r) => setTimeout(r, 800)).then(() =>
          callGeminiNative({ apiKey: GOOGLE_GEMINI_API_KEY, systemInstruction: baseSystem, prompt: promptB, schema: schemaB, tag: "daily-guide-B", maxOutputTokens: 2200, timeoutMs: 60000 })
        ),
      ]);

      if (resA.status === "rejected") {
        const e = resA.reason;
        if (e instanceof GeminiError) {
          if (e.status === 429) throw new JobError("Muitas requisições à IA. Aguarde alguns segundos.");
          if (e.status === 402) throw new JobError("Créditos da IA esgotados. Avise o administrador.");
          throw new JobError("O serviço de IA do Google está instável agora. Aguarde 1-2 minutos e tente novamente — sua cota não foi consumida.");
        }
        throw new JobError("Erro ao gerar guia diário. Tente novamente.");
      }

      const partA = resA.value.json as Record<string, unknown>;
      const taskExamples: Record<string, unknown> = resB.status === "fulfilled" ? (resB.value.json as Record<string, unknown>) : {};
      if (resB.status === "rejected") console.warn(`[start-daily-guide-job] job ${jobId} call B falhou — sem taskExamples`, resB.reason);

      const content = { ...partA, taskExamples };

      try {
        await Promise.all([
          admin.from("user_usage").update({ tool_generations: currentCount + 1, last_tool_date: today }).eq("user_id", userId),
          admin.from("usage_logs").insert({ user_id: userId, feature: "daily_guide" }),
        ]);
      } catch (e) {
        console.warn(`[start-daily-guide-job] usage update failed for job ${jobId}`, e);
      }

      console.log(`[start-daily-guide-job] job ${jobId} success`, { day, totalMs: Date.now() - startedAt });
      return content;
    });

    return jsonResponse({ jobId });
  } catch (e) {
    console.error("[start-daily-guide-job] uncaught error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
