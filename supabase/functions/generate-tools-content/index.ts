import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callGeminiWithRetry(body: Record<string, unknown>, apiKey: string, timeoutMs = 90000): Promise<Response> {
  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    const r = await attempt();
    if (r.status >= 500) {
      console.warn("Gemini 5xx, retrying once:", r.status);
      try { await r.text(); } catch { /* ignore */ }
      return await attempt();
    }
    return r;
  } catch (e) {
    if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
      console.warn("Gemini timeout, retrying once");
      return await attempt();
    }
    throw e;
  }
}

const TOOL_PROMPTS: Record<string, { system: (ap: Record<string, unknown>, niche: string, style: string) => string; user: (input: string, niche: string) => string }> = {
  dissonance: {
    system: (ap, niche, style) => `Você é especialista em copywriting de dissonância cognitiva para o nicho "${niche}". Use linguagem neutra de gênero.\nEstilo: ${style}.\n\nPERFIL DO PÚBLICO:\nAvatar: ${ap.avatar || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto: ${ap.deepOccultDesire || ''}\nFeridas: ${JSON.stringify(ap.coreWounds || [])}\nGatilhos de vergonha: ${JSON.stringify(ap.shameTriggers || [])}\nObjeções: ${JSON.stringify(ap.objections || [])}\nCrenças equivocadas: ${JSON.stringify(ap.mistakenBeliefs || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\n\nCrie ganchos que unem conceitos contraditórios usando as feridas e desejos do público.`,
    user: (input, niche) => `Gere 10 ganchos de dissonância cognitiva para "${niche}".\n${input ? `Contexto: ${input}` : ''}\nPara cada gancho: frase de impacto, por que funciona, qual ferida/desejo toca.\nRetorne usando a function tool.`,
  },
  patterns: {
    system: (ap, niche, style) => `Você é analista de padrões de copywriting para "${niche}".\nEstilo: ${style}.\n\nPERFIL:\nAvatar: ${ap.avatar || ''}\nObjetivo: ${ap.primaryGoal || ''}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\n\nExtraia frameworks, gatilhos emocionais, padrões de CTA e técnicas de storytelling.`,
    user: (input, niche) => `Analise os seguintes anúncios/copies e extraia os padrões:\n\n${input}\n\nPara cada padrão: framework, gatilhos, adaptação ao nicho "${niche}", exemplo prático.\nRetorne usando a function tool.`,
  },
  hooks: {
    system: (ap, niche, style) => `Você é especialista em desconstrução de hooks virais para "${niche}". Use linguagem neutra de gênero.\nEstilo: ${style}.\n\nPERFIL:\nAvatar: ${ap.avatar || ''}\nFeridas: ${JSON.stringify(ap.coreWounds || [])}\nGatilhos vergonha: ${JSON.stringify(ap.shameTriggers || [])}\nÂncoras esperança: ${JSON.stringify(ap.hopeAnchors || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nDesejo oculto: ${ap.deepOccultDesire || ''}\n\nDesconstrua cada hook: gatilho emocional, técnica, por que funciona, 3 variações.`,
    user: (input, niche) => `Desconstrua os seguintes hooks:\n\n${input}\n\nPara cada: gatilho emocional, técnica, 3 variações para "${niche}".\nRetorne usando a function tool.`,
  },
  viral: {
    system: (ap, niche, style) => `Você é roteirista especialista em adaptar conteúdo viral para "${niche}". Use linguagem neutra de gênero.\nEstilo: ${style}.\n\nPERFIL:\nAvatar: ${ap.avatar || ''}\nObjetivo: ${ap.primaryGoal || ''}\nQueixa: ${ap.primaryComplaint || ''}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\nÂncoras identidade: ${JSON.stringify(ap.identityAnchors || [])}\nInimigo: ${ap.commonEnemy || ''}\nDesejo oculto: ${ap.deepOccultDesire || ''}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nRelatabilidade: ${JSON.stringify(ap.everydayRelatability || [])}\n\nMantenha a ESTRUTURA que viralizou, substitua o CONTEÚDO pelo nicho e público.`,
    user: (input, niche) => `Adapte o seguinte conteúdo viral ao nicho "${niche}":\n\n${input}\n\nRetorne: análise da estrutura, script adaptado (hook+corpo+CTA), instruções de gravação, por que vai funcionar.\nRetorne usando a function tool.`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = user.id;

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: usageData } = await adminClient.from("user_usage").select("is_premium, tool_generations, last_tool_date").eq("user_id", userId).maybeSingle();
    const isPremium = usageData?.is_premium ?? false;
    const today = new Date().toISOString().split("T")[0];
    const isNewDay = usageData?.last_tool_date !== today;
    const currentToolCount = isNewDay ? 0 : (usageData?.tool_generations ?? 0);
    if (!isPremium && currentToolCount >= 2) return new Response(JSON.stringify({ error: "Você atingiu o limite de 2 gerações gratuitas de ferramentas IA. Assine o plano premium para uso ilimitado." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await Promise.all([
      adminClient.from("user_usage").update({ tool_generations: currentToolCount + 1, last_tool_date: today }).eq("user_id", userId),
      adminClient.from("usage_logs").insert({ user_id: userId, feature: "tool" }),
    ]);

    const { toolType, userInput, primaryNiche, contentStyle } = await req.json();
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const toolConfig = TOOL_PROMPTS[toolType];
    if (!toolConfig) return new Response(JSON.stringify({ error: "Tipo de ferramenta inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: audienceData } = await supabase.from("audience_profiles").select("avatar_profile").eq("user_id", userId).maybeSingle();
    const ap = (audienceData?.avatar_profile as Record<string, unknown>) || {};
    const niche = primaryNiche || "lifestyle";
    const styleMap: Record<string, string> = { casual: "leve, descontraído", profissional: "autoritário, informativo", divertido: "engraçado, irreverente" };
    const style = styleMap[contentStyle] || styleMap.casual;

    const toolSchemas: Record<string, object> = {
      dissonance: { type: "object", properties: { hooks: { type: "array", items: { type: "object", properties: { hook: { type: "string" }, whyItWorks: { type: "string" }, emotionalTrigger: { type: "string" } }, required: ["hook", "whyItWorks", "emotionalTrigger"] } } }, required: ["hooks"], additionalProperties: false },
      patterns: { type: "object", properties: { patterns: { type: "array", items: { type: "object", properties: { framework: { type: "string" }, emotionalTriggers: { type: "string" }, adaptation: { type: "string" }, example: { type: "string" } }, required: ["framework", "emotionalTriggers", "adaptation", "example"] } } }, required: ["patterns"], additionalProperties: false },
      hooks: { type: "object", properties: { analyses: { type: "array", items: { type: "object", properties: { originalHook: { type: "string" }, emotionalTrigger: { type: "string" }, technique: { type: "string" }, variations: { type: "array", items: { type: "string" } } }, required: ["originalHook", "emotionalTrigger", "technique", "variations"] } } }, required: ["analyses"], additionalProperties: false },
      viral: { type: "object", properties: { structureAnalysis: { type: "string" }, adaptedScript: { type: "object", properties: { hook: { type: "string" }, body: { type: "string" }, cta: { type: "string" } }, required: ["hook", "body", "cta"] }, filmingInstructions: { type: "string" }, whyItWillWork: { type: "string" } }, required: ["structureAnalysis", "adaptedScript", "filmingInstructions", "whyItWillWork"], additionalProperties: false },
    };

    const response = await callGeminiWithRetry({
      model: "gemini-2.5-flash",
      messages: [{ role: "system", content: toolConfig.system(ap, niche, style) }, { role: "user", content: toolConfig.user(userInput || "", niche) }],
      tools: [{ type: "function", function: { name: "generate_result", description: "Retorna o resultado da ferramenta de IA", parameters: toolSchemas[toolType] } }],
      tool_choice: { type: "function", function: { name: "generate_result" } },
    }, GOOGLE_GEMINI_API_KEY);

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const text = await response.text(); console.error("AI error:", response.status, text);
      return new Response(JSON.stringify({ error: "A IA está demorando mais que o normal. Tente novamente em alguns segundos." }), { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("Resposta da IA sem dados estruturados");
    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-tools-content error:", e);
    const isAbort = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
    return new Response(
      JSON.stringify({ error: isAbort ? "A IA está demorando mais que o normal. Tente novamente em alguns segundos." : (e instanceof Error ? e.message : "Erro desconhecido") }),
      { status: isAbort ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});