import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiNative, GeminiError } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

console.log("[tools-content] boot — using native endpoint, responseSchema");

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

  let userId: string | null = null;
  let adminClient: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Não autorizado" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Não autorizado" }, 401);
    userId = user.id;

    adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { toolType, userInput, primaryNiche, contentStyle } = await req.json();
    console.log("[tools-content] start", { userId, toolType });

    const toolConfig = TOOL_PROMPTS[toolType];
    if (!toolConfig) return jsonResponse({ error: "Tipo de ferramenta inválido" }, 400);

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) return jsonResponse({ error: "Configuração do servidor incompleta (chave da IA ausente)." }, 500);

    const t0 = Date.now();
    const [usageRes, audienceRes] = await Promise.all([
      adminClient.from("user_usage").select("is_premium, tool_generations, last_tool_date").eq("user_id", userId).maybeSingle(),
      supabase.from("audience_profiles").select("avatar_profile").eq("user_id", userId).maybeSingle(),
    ]);
    const usageData = usageRes.data;
    const audienceData = audienceRes.data;
    console.log("[tools-content] db parallel fetch", { userId, ms: Date.now() - t0 });

    const isPremium = usageData?.is_premium ?? false;
    const today = new Date().toISOString().split("T")[0];
    const isNewDay = usageData?.last_tool_date !== today;
    const currentToolCount = isNewDay ? 0 : (usageData?.tool_generations ?? 0);
    if (!isPremium && currentToolCount >= 2) return jsonResponse({ error: "Você atingiu o limite de 2 gerações gratuitas de ferramentas IA. Assine o plano premium para uso ilimitado." }, 429);

    const ap = (audienceData?.avatar_profile as Record<string, unknown>) || {};
    const niche = primaryNiche || "lifestyle";
    const styleMap: Record<string, string> = { casual: "leve, descontraído", profissional: "autoritário, informativo", divertido: "engraçado, irreverente" };
    const style = styleMap[contentStyle] || styleMap.casual;

    let result;
    try {
      result = await callGeminiNative({
        apiKey: GOOGLE_GEMINI_API_KEY,
        systemInstruction: toolConfig.system(ap, niche, style),
        prompt: toolConfig.user(userInput || "", niche),
        schema: TOOL_SCHEMAS[toolType],
        tag: `tools-${toolType}`,
        maxOutputTokens: 3000,
        timeoutMs: 75000,
      });
    } catch (e) {
      if (e instanceof GeminiError) {
        if (e.status === 429) return jsonResponse({ error: "Muitas requisições à IA. Aguarde alguns segundos." }, 429);
        if (e.status === 402) return jsonResponse({ error: "Créditos da IA esgotados." }, 402);
        if (e.status === 503) return jsonResponse({ error: "O serviço de IA do Google está instável agora. Aguarde 1-2 minutos e tente novamente." }, 503);
        return jsonResponse({ error: e.message }, 502);
      }
      throw e;
    }

    const out = result.json as Record<string, unknown>;

    // Compatibilidade com frontend: viral espera adaptedScript aninhado.
    if (toolType === "viral" && (out.scriptHook || out.scriptBody || out.scriptCta)) {
      out.adaptedScript = {
        hook: out.scriptHook ?? "",
        body: out.scriptBody ?? "",
        cta: out.scriptCta ?? "",
      };
      delete out.scriptHook; delete out.scriptBody; delete out.scriptCta;
    }

    try {
      await Promise.all([
        adminClient.from("user_usage").update({ tool_generations: currentToolCount + 1, last_tool_date: today }).eq("user_id", userId),
        adminClient.from("usage_logs").insert({ user_id: userId, feature: "tool" }),
      ]);
    } catch (e) {
      console.warn("[tools-content] usage update failed (non-fatal)", e);
    }

    console.log("[tools-content] success", { userId, toolType, model: result.modelUsed, latencyMs: result.latencyMs });
    return jsonResponse(out);
  } catch (e) {
    console.error("[tools-content] uncaught error:", e, { userId });
    const isAbort = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
    return jsonResponse({ error: isAbort ? "A IA está demorando mais que o normal. Tente novamente." : (e instanceof Error ? e.message : "Erro interno") }, isAbort ? 504 : 500);
  }
});
