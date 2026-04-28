// start-script-job
// Cria job assíncrono pra geração de script (Gerador de Script no DayDetail).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiNative, GeminiError } from "../_shared/gemini.ts";
import { corsHeaders, jsonResponse, enqueueJob, runInBackground, JobError } from "../_shared/ai-job-runner.ts";

const FUNCTION_VERSION = "2026-04-28-async-script";
console.log(`[start-script-job] boot v=${FUNCTION_VERSION}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json() as Record<string, unknown>;

    const result = await enqueueJob({ req, jobType: "script", payload });
    if (result instanceof Response) return result;
    const { jobId, userId, userClient, admin } = result;

    runInBackground(admin, jobId, async () => {
      const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
      if (!GOOGLE_GEMINI_API_KEY) throw new JobError("Configuração do servidor incompleta (chave da IA ausente).");

      const [usageRes, audienceRes] = await Promise.all([
        admin.from("user_usage").select("is_premium, script_generations, last_script_date").eq("user_id", userId).maybeSingle(),
        userClient.from("audience_profiles").select("avatar_profile").eq("user_id", userId).maybeSingle(),
      ]);
      const usageData = usageRes.data as { is_premium?: boolean; script_generations?: number; last_script_date?: string } | null;
      const audienceData = audienceRes.data as { avatar_profile?: Record<string, unknown> } | null;

      const isPremium = usageData?.is_premium ?? false;
      const today = new Date().toISOString().slice(0, 10);
      const isNewDay = usageData?.last_script_date !== today;
      const scriptCount = isNewDay ? 0 : (usageData?.script_generations ?? 0);
      if (!isPremium && scriptCount >= 3) {
        throw new JobError("Você atingiu o limite de 3 scripts por dia. Assine o plano premium para uso ilimitado.");
      }

      const day = payload.day;
      const title = payload.title as string;
      const pillar = payload.pillar as string;
      const pillarLabel = payload.pillarLabel as string;
      const viralHook = payload.viralHook as string;
      const storytellingBody = payload.storytellingBody as string;
      const subtleConversion = payload.subtleConversion as string;
      const primaryNiche = (payload.primaryNiche as string) || "";
      const contentStyle = (payload.contentStyle as string) || "casual";
      const visceralElement = (payload.visceralElement as string) || "";

      let visceralContext = "";
      if (audienceData?.avatar_profile) {
        const ap = audienceData.avatar_profile;
        visceralContext = `\n\nPERFIL PSICOLÓGICO DO PÚBLICO\nAvatar: ${ap.avatar || ''}\nObjetivo principal: ${ap.primaryGoal || ''}\nQueixa principal: ${ap.primaryComplaint || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto profundo: ${ap.deepOccultDesire || ''}\nInimigo comum: ${ap.commonEnemy || ''}\nGap de autoimagem: ${ap.selfImageGap || ''}\nFeridas centrais: ${JSON.stringify(ap.coreWounds || [])}\nObjeções: ${JSON.stringify(ap.objections || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nGatilhos de vergonha: ${JSON.stringify(ap.shameTriggers || [])}\nÂncoras de esperança: ${JSON.stringify(ap.hopeAnchors || [])}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\nFalsas soluções: ${JSON.stringify(ap.falseSolutions || [])}\n\nINSTRUÇÕES:\nHOOK: ative shameTriggers/coreWounds, use verbalTriggers\nSTORYTELLING: explore frustrations, falseSolutions, commonEnemy, selfImageGap\nCTA: fale ao deepOccultDesire, use hopeAnchors`;
      }

      const styleMap: Record<string, string> = { casual: "leve, descontraído", profissional: "autoritário, informativo", divertido: "engraçado, irreverente" };
      const styleDesc = styleMap[contentStyle] || styleMap.casual;
      const nicheContext = primaryNiche ? `\nO nicho principal do(a) criador(a) de conteúdo é: ${primaryNiche}.` : '';
      const visceralInstruction = visceralElement ? `\n\nGATILHO VISCERAL OBRIGATÓRIO: ${visceralElement}\n- O HOOK deve ativar EXATAMENTE este gatilho\n- O STORYTELLING deve explorar este tema emocional\n- O CTA deve conectar este gatilho à transformação` : "";

      const systemInstruction = `Você é copywriter especialista em conteúdo para criadores de conteúdo brasileiros. Use linguagem neutra de gênero.${nicheContext}\nEstilo: ${styleDesc}.\n${visceralContext}${visceralInstruction}\n\nRegras: Linguagem natural e coloquial em PT-BR. Hooks com curiosidade imediata. Storytelling pessoal e emocional. CTA sutil. Adapte ao nicho "${primaryNiche || 'lifestyle'}". Cada script deve ser ÚNICO.`;
      const prompt = `Crie uma versão NOVA e MELHORADA do script para o Dia ${day}.\nPilar: ${pillarLabel} (${pillar})\nTítulo: ${title}\n${visceralElement ? `GATILHO VISCERAL: ${visceralElement}\n` : ""}Script de referência (NÃO copie):\n- Hook: ${viralHook}\n- Corpo: ${storytellingBody}\n- CTA: ${subtleConversion}\n\nGere script completamente novo. Adapte ao nicho "${primaryNiche || 'lifestyle'}". Retorne JSON com viralHook, storytellingBody e subtleConversion.`;

      let geminiResult: Awaited<ReturnType<typeof callGeminiNative>> | undefined;
      let lastErr: unknown;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          geminiResult = await callGeminiNative({
            apiKey: GOOGLE_GEMINI_API_KEY,
            systemInstruction,
            prompt,
            schema: { type: "object", properties: { viralHook: { type: "string" }, storytellingBody: { type: "string" }, subtleConversion: { type: "string" } }, required: ["viralHook", "storytellingBody", "subtleConversion"] },
            tag: `script-try${attempt}`,
            maxOutputTokens: 2000,
            timeoutMs: 60000,
            primaryAttempts: 2,
            fallbackAttempts: 2,
          });
          break;
        } catch (e) {
          lastErr = e;
          const status = e instanceof GeminiError ? e.status : 0;
          if (status === 429 || status === 402) break;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
        }
      }

      if (!geminiResult) {
        const e = lastErr;
        if (e instanceof GeminiError) {
          if (e.status === 429) throw new JobError("Muitas requisições à IA. Aguarde alguns segundos.");
          if (e.status === 402) throw new JobError("Créditos da IA esgotados.");
          throw new JobError("O serviço de IA do Google está instável agora. Aguarde 1-2 minutos e tente novamente — sua cota não foi consumida.");
        }
        throw e;
      }

      const script = geminiResult.json as Record<string, unknown>;
      if (!script?.viralHook || !script?.storytellingBody || !script?.subtleConversion) {
        throw new JobError("A IA retornou um script incompleto. Tente novamente.");
      }

      try {
        await Promise.all([
          admin.from("user_usage").update({ script_generations: scriptCount + 1, last_script_date: today }).eq("user_id", userId),
          admin.from("usage_logs").insert({ user_id: userId, feature: "script" }),
        ]);
      } catch (e) {
        console.warn(`[start-script-job] usage update failed for job ${jobId}`, e);
      }

      console.log(`[start-script-job] job ${jobId} success`, { day, model: geminiResult.modelUsed, latencyMs: geminiResult.latencyMs, attempts: geminiResult.attempts });
      return { ...script, __meta: { attempts: geminiResult.attempts, modelUsed: geminiResult.modelUsed } };
    });

    return jsonResponse({ jobId });
  } catch (e) {
    console.error("[start-script-job] uncaught error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
