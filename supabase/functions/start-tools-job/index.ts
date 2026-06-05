// start-tools-job
// Cria job assíncrono pra ferramenta IA (dissonance/patterns/hooks/viral) e retorna {jobId}.
// Worker processa em EdgeRuntime.waitUntil → imune a timeout Kong/Cloudflare.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiNative, GeminiError } from "../_shared/gemini.ts";
import { corsHeaders, jsonResponse, enqueueJob, runInBackground, JobError } from "../_shared/ai-job-runner.ts";

const FUNCTION_VERSION = "2026-04-28-async-tools";
console.log(`[start-tools-job] boot v=${FUNCTION_VERSION}`);

// Regras de qualidade linguística aplicadas a TODOS os prompts.
// Removemos "linguagem neutra de gênero" porque o Gemini gerava "todes/amigues/x/e"
// que o usuário final lê como erro de português. Substituímos por norma culta + reformulação.
const PT_BR_RULES = `IDIOMA E QUALIDADE DE ESCRITA (OBRIGATÓRIO):
- Escreva em português brasileiro padrão (norma culta), com ortografia, acentuação e concordância impecáveis.
- PROIBIDO: "todes", "amigues", "elu", "x"/"e"/"@" substituindo gênero (ex.: "tod@s", "amigxs", "seguidorxs"), gírias mal escritas, abreviações tipo "vc", "pq", "tb", "tbm", "q", "mt".
- Quando quiser evitar marcar gênero, REFORMULE a frase (ex.: "quem assiste", "a pessoa que", "a galera", "o público", "quem está aqui") em vez de inventar terminação.
- Antes de devolver, revise mentalmente cada frase para ortografia e concordância como se fosse publicar agora.`;

const TOOL_PROMPTS: Record<string, { system: (ap: Record<string, unknown>, niche: string, style: string) => string; user: (input: string, niche: string) => string }> = {
  dissonance: {
    system: (ap, niche, style) => `Você é especialista em copywriting de dissonância cognitiva para o nicho "${niche}".\n${PT_BR_RULES}\nEstilo: ${style}.\n\nPERFIL DO PÚBLICO:\nAvatar: ${ap.avatar || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto: ${ap.deepOccultDesire || ''}\nFeridas: ${JSON.stringify(ap.coreWounds || [])}\nGatilhos de vergonha: ${JSON.stringify(ap.shameTriggers || [])}\nObjeções: ${JSON.stringify(ap.objections || [])}\nCrenças equivocadas: ${JSON.stringify(ap.mistakenBeliefs || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\n\nCrie ganchos que unem conceitos contraditórios usando as feridas e desejos do público.`,
    user: (input, niche) => `Gere 10 ganchos de dissonância cognitiva para "${niche}".\n${input ? `Contexto: ${input}` : ''}\nPara cada gancho: frase de impacto, por que funciona, qual ferida/desejo toca.`,
  },
  patterns: {
    system: (ap, niche, style) => `Você é analista de padrões de copywriting para "${niche}".\n${PT_BR_RULES}\nEstilo: ${style}.\n\nPERFIL:\nAvatar: ${ap.avatar || ''}\nObjetivo: ${ap.primaryGoal || ''}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\n\nExtraia frameworks, gatilhos emocionais, padrões de CTA e técnicas de storytelling.`,
    user: (input, niche) => `Analise os seguintes anúncios/copies e extraia os padrões:\n\n${input}\n\nPara cada padrão: framework, gatilhos, adaptação ao nicho "${niche}", exemplo prático.`,
  },
  hooks: {
    system: (ap, niche, style) => `Você é especialista em desconstrução de hooks virais para "${niche}".\n${PT_BR_RULES}\nEstilo: ${style}.\n\nPERFIL:\nAvatar: ${ap.avatar || ''}\nFeridas: ${JSON.stringify(ap.coreWounds || [])}\nGatilhos vergonha: ${JSON.stringify(ap.shameTriggers || [])}\nÂncoras esperança: ${JSON.stringify(ap.hopeAnchors || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nDesejo oculto: ${ap.deepOccultDesire || ''}\n\nDesconstrua cada hook: gatilho emocional, técnica, por que funciona, 3 variações.`,
    user: (input, niche) => `Desconstrua os seguintes hooks:\n\n${input}\n\nPara cada: gatilho emocional, técnica, 3 variações para "${niche}".`,
  },
  viral: {
    system: (ap, niche, style) => `Você é roteirista especialista em adaptar conteúdo viral para "${niche}".\n${PT_BR_RULES}\nEstilo: ${style}.\n\nPERFIL:\nAvatar: ${ap.avatar || ''}\nObjetivo: ${ap.primaryGoal || ''}\nQueixa: ${ap.primaryComplaint || ''}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\nÂncoras identidade: ${JSON.stringify(ap.identityAnchors || [])}\nInimigo: ${ap.commonEnemy || ''}\nDesejo oculto: ${ap.deepOccultDesire || ''}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nRelatabilidade: ${JSON.stringify(ap.everydayRelatability || [])}\n\nMantenha a ESTRUTURA que viralizou, substitua o CONTEÚDO pelo nicho e público.`,
    user: (input, niche) => `Adapte o seguinte conteúdo viral ao nicho "${niche}":\n\n${input}\n\nRetorne: análise da estrutura, script adaptado (hook+corpo+CTA), instruções de gravação, por que vai funcionar.`,
  },
  reelsDescription: {
    system: (_ap, _niche, _style) => `Você é Master Copywriter de Instagram especializado em legendas de Reels.\n${PT_BR_RULES}\n\nMISSÃO: criar uma legenda FIEL ao conteúdo do vídeo enviado. Você NÃO conhece o nicho do criador, NÃO tem perfil de público e NÃO deve assumir nenhum. Trabalhe APENAS com o texto/tema que o usuário enviou.\n\nREGRAS DE FIDELIDADE (INEGOCIÁVEIS):\n- NÃO invente produto, serviço, oferta, autoridade, profissão, dor de público, número, estatística ou exemplo que não esteja explícito no texto enviado.\n- NÃO force encaixe em nenhum nicho (beleza, fitness, marketing, lifestyle, etc.). Se o vídeo fala de café, a legenda é sobre café — não vira "dica de empreendedorismo".\n- NÃO mude o ângulo, a tese ou a conclusão do criador. Seu trabalho é EMBALAR o que ele já disse, não reescrever a mensagem.\n- Tom e vocabulário devem espelhar o do vídeo (se é casual, é casual; se é técnico, é técnico).\n\nREGRAS DE FORMATO:\n- 1ª linha É o hook que segura o scroll — extraído da ideia central ou da primeira frase forte do próprio vídeo. Sem "Você sabia que...".\n- Máximo 2200 caracteres no fullCaption.\n- Quebras de linha curtas (mobile-first), parágrafos de 1-3 linhas.\n- Emojis com PROPÓSITO (ancorar emoção/listar), nunca decoração.\n- CTA conversacional no fim (pede comentário/save/compartilhar) coerente com o tema do vídeo.\n- Hashtags: 8-15, derivadas DO TEMA do vídeo (palavras-chave do próprio conteúdo) — mix de amplas + específicas + cauda longa. SEM o caractere #. Minúsculas, sem acento, sem espaço (ex.: "marketingdigital", "cafeespecial").\n- 3 hooks alternativos pra A/B test (variações do hookLine, todas fiéis ao conteúdo).`,
    user: (input, _niche) => `Conteúdo do Reel (transcrição ou tema enviado pelo usuário):\n\n${input}\n\nGere a legenda completa pronta pra colar no Instagram + 3 hooks alternativos + hashtags estratégicas baseadas NO TEMA acima. Seja 100% fiel ao que está escrito — não invente nicho, público nem ângulo. Revise ortografia e concordância antes de devolver.`,
  },
};

const TOOL_SCHEMAS: Record<string, object> = {
  dissonance: { type: "object", properties: { hooks: { type: "array", items: { type: "object", properties: { hook: { type: "string" }, whyItWorks: { type: "string" }, emotionalTrigger: { type: "string" } }, required: ["hook", "whyItWorks", "emotionalTrigger"] } } }, required: ["hooks"] },
  patterns: { type: "object", properties: { patterns: { type: "array", items: { type: "object", properties: { framework: { type: "string" }, emotionalTriggers: { type: "string" }, adaptation: { type: "string" }, example: { type: "string" } }, required: ["framework", "emotionalTriggers", "adaptation", "example"] } } }, required: ["patterns"] },
  hooks: { type: "object", properties: { analyses: { type: "array", items: { type: "object", properties: { originalHook: { type: "string" }, emotionalTrigger: { type: "string" }, technique: { type: "string" }, variations: { type: "array", items: { type: "string" } } }, required: ["originalHook", "emotionalTrigger", "technique", "variations"] } } }, required: ["analyses"] },
  viral: { type: "object", properties: { structureAnalysis: { type: "string" }, scriptHook: { type: "string" }, scriptBody: { type: "string" }, scriptCta: { type: "string" }, filmingInstructions: { type: "string" }, whyItWillWork: { type: "string" } }, required: ["structureAnalysis", "scriptHook", "scriptBody", "scriptCta", "filmingInstructions", "whyItWillWork"] },
  reelsDescription: { type: "object", properties: { hookLine: { type: "string" }, body: { type: "string" }, cta: { type: "string" }, fullCaption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, alternativeHooks: { type: "array", items: { type: "string" } } }, required: ["hookLine", "body", "cta", "fullCaption", "hashtags", "alternativeHooks"] },
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
          model: "gemini-2.5-flash",
          midModel: "gemini-2.5-flash-lite",
          fallbackModel: "gemini-2.5-pro",
          maxOutputTokens: 3000,
          timeoutMs: 45000,
          midTimeoutMs: 35000,
          fallbackTimeoutMs: 60000,
          primaryAttempts: 3,
          midAttempts: 2,
          fallbackAttempts: 1,
        });
      } catch (e) {
        if (e instanceof GeminiError) {
          if (e.status === 429) throw new JobError("Muitas requisições à IA. Aguarde alguns segundos e tente de novo.");
          if (e.status === 402) throw new JobError("Créditos da IA esgotados.");
          if (e.status === 502) throw new JobError("A IA respondeu em formato inválido. Tente novamente.", e);
          if (e.status === 503) throw new JobError("O serviço de IA está instável agora. Aguarde 1-2 minutos e tente novamente.", e);
          throw new JobError(e.message, e);
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
