// start-tools-job
// Cria job assíncrono pra ferramenta IA (dissonance/patterns/hooks/viral) e retorna {jobId}.
// Worker processa em EdgeRuntime.waitUntil → imune a timeout Kong/Cloudflare.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiNative, GeminiError } from "../_shared/gemini.ts";
import { corsHeaders, jsonResponse, enqueueJob, runInBackground, JobError } from "../_shared/ai-job-runner.ts";

const FUNCTION_VERSION = "2026-04-28-async-tools";
console.log(`[start-tools-job] boot v=${FUNCTION_VERSION}`);

const TOOL_PROMPTS: Record<string, { system: (ap: Record<string, unknown>, niche: string, style: string) => string; user: (input: string, niche: string) => string }> = {
  dissonance: {
    system: (ap, niche, style) => `Você é especialista em copywriting de dissonância cognitiva para o nicho "${niche}". Use linguagem neutra de gênero.\nEstilo: ${style}.\n\nPERFIL DO PÚBLICO:\nAvatar: ${ap.avatar || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto: ${ap.deepOccultDesire || ''}\nFeridas: ${JSON.stringify(ap.coreWounds || [])}\nGatilhos de vergonha: ${JSON.stringify(ap.shameTriggers || [])}\nObjeções: ${JSON.stringify(ap.objections || [])}\nCrenças equivocadas: ${JSON.stringify(ap.mistakenBeliefs || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\n\nCrie ganchos que unem conceitos contraditórios usando as feridas e desejos do público.`,
    user: (input, niche) => `Gere 10 ganchos de dissonância cognitiva para "${niche}".\n${input ? `Contexto: ${input}` : ''}\nPara cada gancho: frase de impacto, por que funciona, qual ferida/desejo toca.`,
  },
  patterns: {
    system: (ap, niche, style) => `Você é analista de padrões de copywriting para "${niche}".\nEstilo: ${style}.\n\nPERFIL:\nAvatar: ${ap.avatar || ''}\nObjetivo: ${ap.primaryGoal || ''}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\n\nExtraia frameworks, gatilhos emocionais, padrões de CTA e técnicas de storytelling.`,
    user: (input, niche) => `Analise os seguintes anúncios/copies e extraia os padrões:\n\n${input}\n\nPara cada padrão: framework, gatilhos, adaptação ao nicho "${niche}", exemplo prático.`,
  },
  hooks: {
    system: (ap, niche, style) => `Você é especialista em desconstrução de hooks virais para "${niche}". Use linguagem neutra de gênero.\nEstilo: ${style}.\n\nPERFIL:\nAvatar: ${ap.avatar || ''}\nFeridas: ${JSON.stringify(ap.coreWounds || [])}\nGatilhos vergonha: ${JSON.stringify(ap.shameTriggers || [])}\nÂncoras esperança: ${JSON.stringify(ap.hopeAnchors || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nDesejo oculto: ${ap.deepOccultDesire || ''}\n\nDesconstrua cada hook: gatilho emocional, técnica, por que funciona, 3 variações.`,
    user: (input, niche) => `Desconstrua os seguintes hooks:\n\n${input}\n\nPara cada: gatilho emocional, técnica, 3 variações para "${niche}".`,
  },
  viral: {
    system: (ap, niche, style) => `Você é roteirista especialista em adaptar conteúdo viral para "${niche}". Use linguagem neutra de gênero.\nEstilo: ${style}.\n\nPERFIL:\nAvatar: ${ap.avatar || ''}\nObjetivo: ${ap.primaryGoal || ''}\nQueixa: ${ap.primaryComplaint || ''}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\nÂncoras identidade: ${JSON.stringify(ap.identityAnchors || [])}\nInimigo: ${ap.commonEnemy || ''}\nDesejo oculto: ${ap.deepOccultDesire || ''}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nRelatabilidade: ${JSON.stringify(ap.everydayRelatability || [])}\n\nMantenha a ESTRUTURA que viralizou, substitua o CONTEÚDO pelo nicho e público.`,
    user: (input, niche) => `Adapte o seguinte conteúdo viral ao nicho "${niche}":\n\n${input}\n\nRetorne: análise da estrutura, script adaptado (hook+corpo+CTA), instruções de gravação, por que vai funcionar.`,
  },
};

const TOOL_SCHEMAS: Record<string, object> = {
  dissonance: { type: "object", properties: { hooks: { type: "array", items: { type: "object", properties: { hook: { type: "string" }, whyItWorks: { type: "string" }, emotionalTrigger: { type: "string" } }, required: ["hook", "whyItWorks", "emotionalTrigger"] } } }, required: ["hooks"] },
  patterns: { type: "object", properties: { patterns: { type: "array", items: { type: "object", properties: { framework: { type: "string" }, emotionalTriggers: { type: "string" }, adaptation: { type: "string" }, example: { type: "string" } }, required: ["framework", "emotionalTriggers", "adaptation", "example"] } } }, required: ["patterns"] },
  hooks: { type: "object", properties: { analyses: { type: "array", items: { type: "object", properties: { originalHook: { type: "string" }, emotionalTrigger: { type: "string" }, technique: { type: "string" }, variations: { type: "array", items: { type: "string" } } }, required: ["originalHook", "emotionalTrigger", "technique", "variations"] } } }, required: ["analyses"] },
  viral: { type: "object", properties: { structureAnalysis: { type: "string" }, scriptHook: { type: "string" }, scriptBody: { type: "string" }, scriptCta: { type: "string" }, filmingInstructions: { type: "string" }, whyItWillWork: { type: "string" } }, required: ["structureAnalysis", "scriptHook", "scriptBody", "scriptCta", "filmingInstructions", "whyItWillWork"] },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json() as Record<string, unknown>;
    const toolType = payload.toolType as string;

    if (!TOOL_PROMPTS[toolType]) {
      return jsonResponse({ error: "Tipo de ferramenta inválido" }, 400);
    }

    const result = await enqueueJob({ req, jobType: "tools", payload });
    if (result instanceof Response) return result;
    const { jobId, userId, userClient, admin } = result;

    runInBackground(admin, jobId, async () => {
      const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
      if (!GOOGLE_GEMINI_API_KEY) throw new JobError("Configuração do servidor incompleta (chave da IA ausente).");

      const userInput = (payload.userInput as string) || "";
      const primaryNiche = (payload.primaryNiche as string) || "";
      const contentStyle = (payload.contentStyle as string) || "casual";

      // Quota check + audience profile em paralelo
      const [usageRes, audienceRes] = await Promise.all([
        admin.from("user_usage").select("is_premium, tool_generations, last_tool_date").eq("user_id", userId).maybeSingle(),
        userClient.from("audience_profiles").select("avatar_profile").eq("user_id", userId).maybeSingle(),
      ]);
      const usageData = usageRes.data as { is_premium?: boolean; tool_generations?: number; last_tool_date?: string } | null;
      const audienceData = audienceRes.data as { avatar_profile?: Record<string, unknown> } | null;

      const isPremium = usageData?.is_premium ?? false;
      const today = new Date().toISOString().split("T")[0];
      const isNewDay = usageData?.last_tool_date !== today;
      const currentToolCount = isNewDay ? 0 : (usageData?.tool_generations ?? 0);
      if (!isPremium && currentToolCount >= 2) {
        throw new JobError("Você atingiu o limite de 2 gerações gratuitas de ferramentas IA. Assine o plano premium para uso ilimitado.");
      }

      const ap = (audienceData?.avatar_profile as Record<string, unknown>) || {};
      const niche = primaryNiche || "lifestyle";
      const styleMap: Record<string, string> = { casual: "leve, descontraído", profissional: "autoritário, informativo", divertido: "engraçado, irreverente" };
      const style = styleMap[contentStyle] || styleMap.casual;
      const toolConfig = TOOL_PROMPTS[toolType];

      let geminiResult;
      try {
        geminiResult = await callGeminiNative({
          apiKey: GOOGLE_GEMINI_API_KEY,
          systemInstruction: toolConfig.system(ap, niche, style),
          prompt: toolConfig.user(userInput, niche),
          schema: TOOL_SCHEMAS[toolType],
          tag: `tools-${toolType}`,
          maxOutputTokens: 3000,
          timeoutMs: 75000,
          fallbackTimeoutMs: 60000,
          primaryAttempts: 2,
          fallbackAttempts: 2,
        });
      } catch (e) {
        if (e instanceof GeminiError) {
          if (e.status === 429) throw new JobError("Muitas requisições à IA. Aguarde alguns segundos e tente de novo.");
          if (e.status === 402) throw new JobError("Créditos da IA esgotados.");
          if (e.status === 503) throw new JobError("O serviço de IA do Google está instável agora. Aguarde 1-2 minutos e tente novamente.");
          throw new JobError(e.message);
        }
        throw e;
      }

      const out = geminiResult.json as Record<string, unknown>;
      // Compatibilidade com frontend: viral espera adaptedScript aninhado.
      if (toolType === "viral" && (out.scriptHook || out.scriptBody || out.scriptCta)) {
        out.adaptedScript = { hook: out.scriptHook ?? "", body: out.scriptBody ?? "", cta: out.scriptCta ?? "" };
        delete out.scriptHook; delete out.scriptBody; delete out.scriptCta;
      }

      // Contabiliza uso (não-fatal se falhar)
      try {
        await Promise.all([
          admin.from("user_usage").update({ tool_generations: currentToolCount + 1, last_tool_date: today }).eq("user_id", userId),
          admin.from("usage_logs").insert({ user_id: userId, feature: "tool" }),
        ]);
      } catch (e) {
        console.warn(`[start-tools-job] usage update failed for job ${jobId}`, e);
      }

      console.log(`[start-tools-job] job ${jobId} success`, { toolType, model: geminiResult.modelUsed, latencyMs: geminiResult.latencyMs, attempts: geminiResult.attempts });
      return { ...out, __meta: { attempts: geminiResult.attempts, modelUsed: geminiResult.modelUsed } };
    });

    return jsonResponse({ jobId });
  } catch (e) {
    console.error("[start-tools-job] uncaught error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
