import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Resilient JSON parse: handles markdown fences, control chars, trailing commas.
function parseLooseJson(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  let s = String(raw ?? "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const cleaned = s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(cleaned);
}

const PRIMARY_MODEL = "gemini-2.5-pro";
const FALLBACK_MODEL = "gemini-2.5-flash";
const RETRIABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGeminiResilient(
  body: Record<string, unknown>,
  apiKey: string,
  tag: string,
  timeoutMs = 60000,
): Promise<Response> {
  const attempt = async (model: string): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  const delays = [1000, 3000, 7000];
  const tryModel = async (model: string): Promise<Response | null> => {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await attempt(model);
        if (!RETRIABLE_STATUSES.has(r.status)) {
          const bodyText = await r.text();
          try {
            const parsed = JSON.parse(bodyText);
            const finish = parsed?.choices?.[0]?.finish_reason as string | undefined;
            if (finish && (finish === "MALFORMED_FUNCTION_CALL" || finish.startsWith("function_call_filter"))) {
              console.warn(`[${tag}] Gemini MALFORMED_FUNCTION_CALL on ${model} attempt ${i + 1}/3 (finish_reason=${finish})`);
              if (i < 2) await sleep(delays[i] + Math.floor(Math.random() * 400));
              continue;
            }
          } catch { /* not JSON, fall through */ }
          return new Response(bodyText, { status: r.status, headers: r.headers });
        }
        console.warn(`[${tag}] Gemini ${r.status} on ${model} attempt ${i + 1}/3`);
        try { await r.text(); } catch { /* ignore */ }
      } catch (e) {
        const isAbort = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
        console.warn(`[${tag}] Gemini ${isAbort ? "timeout" : "network error"} on ${model} attempt ${i + 1}/3`, e instanceof Error ? e.message : e);
        if (i === 2 && !isAbort) throw e;
      }
      if (i < 2) await sleep(delays[i] + Math.floor(Math.random() * 400));
    }
    return null;
  };

  const primary = await tryModel(PRIMARY_MODEL);
  if (primary) return primary;
  console.warn(`[${tag}] Primary model ${PRIMARY_MODEL} exhausted, falling back to ${FALLBACK_MODEL}`);
  const fallback = await tryModel(FALLBACK_MODEL);
  if (fallback) return fallback;
  return new Response(JSON.stringify({ error: { message: "All Gemini attempts failed (primary + fallback)" } }), { status: 503 });
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
    if (!GOOGLE_GEMINI_API_KEY) {
      console.error("[tools-content] missing GOOGLE_GEMINI_API_KEY");
      return jsonResponse({ error: "Configuração do servidor incompleta (chave da IA ausente)." }, 500);
    }

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

    const toolSchemas: Record<string, object> = {
      dissonance: { type: "object", properties: { hooks: { type: "array", items: { type: "object", properties: { hook: { type: "string" }, whyItWorks: { type: "string" }, emotionalTrigger: { type: "string" } }, required: ["hook", "whyItWorks", "emotionalTrigger"] } } }, required: ["hooks"], additionalProperties: false },
      patterns: { type: "object", properties: { patterns: { type: "array", items: { type: "object", properties: { framework: { type: "string" }, emotionalTriggers: { type: "string" }, adaptation: { type: "string" }, example: { type: "string" } }, required: ["framework", "emotionalTriggers", "adaptation", "example"] } } }, required: ["patterns"], additionalProperties: false },
      hooks: { type: "object", properties: { analyses: { type: "array", items: { type: "object", properties: { originalHook: { type: "string" }, emotionalTrigger: { type: "string" }, technique: { type: "string" }, variations: { type: "array", items: { type: "string" } } }, required: ["originalHook", "emotionalTrigger", "technique", "variations"] } } }, required: ["analyses"], additionalProperties: false },
      viral: { type: "object", properties: { structureAnalysis: { type: "string" }, adaptedScript: { type: "object", properties: { hook: { type: "string" }, body: { type: "string" }, cta: { type: "string" } }, required: ["hook", "body", "cta"] }, filmingInstructions: { type: "string" }, whyItWillWork: { type: "string" } }, required: ["structureAnalysis", "adaptedScript", "filmingInstructions", "whyItWillWork"], additionalProperties: false },
    };

    const startedAt = Date.now();
    const response = await callGeminiResilient({
      messages: [{ role: "system", content: toolConfig.system(ap, niche, style) }, { role: "user", content: toolConfig.user(userInput || "", niche) }],
      tools: [{ type: "function", function: { name: "generate_result", description: "Retorna o resultado da ferramenta de IA", parameters: toolSchemas[toolType] } }],
      tool_choice: { type: "function", function: { name: "generate_result" } },
      max_tokens: 2500,
    }, GOOGLE_GEMINI_API_KEY, "tools-content");
    const latencyMs = Date.now() - startedAt;
    console.log("[tools-content] gemini responded", { userId, toolType, status: response.status, latencyMs });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[tools-content] gemini error", { status: response.status, body: text.slice(0, 500) });
      if (response.status === 429) return jsonResponse({ error: "Muitas requisições à IA. Aguarde alguns segundos." }, 429);
      if (response.status === 402) return jsonResponse({ error: "Créditos da IA esgotados. Avise o administrador." }, 402);
      if (response.status === 503) return jsonResponse({ error: "O serviço de IA do Google está instável agora (Gemini 503). Aguarde 1-2 minutos e tente novamente." }, 503);
      return jsonResponse({ error: "A IA está demorando mais que o normal. Tente novamente em alguns segundos." }, 504);
    }

    const data = await response.json().catch((e) => {
      console.error("[tools-content] failed to parse gemini json envelope", e);
      return null;
    });
    if (!data) return jsonResponse({ error: "A IA retornou resposta inválida. Tente novamente." }, 502);

    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      console.error("[tools-content] no tool_calls in response", {
        finishReason: data?.choices?.[0]?.finish_reason,
        messageKeys: Object.keys(data?.choices?.[0]?.message || {}),
        sample: JSON.stringify(data).slice(0, 800),
      });
      return jsonResponse({ error: "A IA retornou resposta sem dados estruturados. Tente novamente." }, 502);
    }

    let result: Record<string, unknown>;
    try {
      result = parseLooseJson(args);
    } catch (e) {
      console.error("[tools-content] failed to parse tool arguments JSON", { sample: String(args).slice(0, 500), err: String(e) });
      return jsonResponse({ error: "A IA retornou JSON inválido. Tente novamente." }, 502);
    }

    // Sucesso: agora sim contabiliza uso
    try {
      await Promise.all([
        adminClient.from("user_usage").update({ tool_generations: currentToolCount + 1, last_tool_date: today }).eq("user_id", userId),
        adminClient.from("usage_logs").insert({ user_id: userId, feature: "tool" }),
      ]);
    } catch (e) {
      console.warn("[tools-content] usage update failed (non-fatal)", e);
    }

    console.log("[tools-content] success", { userId, toolType, latencyMs });
    return jsonResponse(result);
  } catch (e) {
    console.error("[tools-content] uncaught error:", e, { userId });
    const isAbort = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
    return jsonResponse(
      { error: isAbort ? "A IA está demorando mais que o normal. Tente novamente em alguns segundos." : (e instanceof Error ? e.message : "Erro interno") },
      isAbort ? 504 : 500
    );
  }
});
