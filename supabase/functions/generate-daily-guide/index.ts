import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.0-flash";
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
        if (!RETRIABLE_STATUSES.has(r.status)) return r;
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let userId: string | null = null;
  let adminClient: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Não autorizado" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Não autorizado" }, 401);
    userId = user.id;

    adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const t0 = Date.now();
    const [usageRes, audienceRes] = await Promise.all([
      adminClient.from("user_usage").select("is_premium, tool_generations, last_tool_date").eq("user_id", userId).maybeSingle(),
      supabaseAuth.from("audience_profiles").select("avatar_profile").eq("user_id", userId).maybeSingle(),
    ]);
    const usageData = usageRes.data;
    const audienceData = audienceRes.data;
    console.log("[daily-guide] db parallel fetch", { userId, ms: Date.now() - t0 });

    const isPremium = usageData?.is_premium ?? false;
    const today = new Date().toISOString().split("T")[0];
    const isNewDay = usageData?.last_tool_date !== today;
    const currentCount = isNewDay ? 0 : (usageData?.tool_generations ?? 0);

    if (!isPremium && currentCount >= 2) {
      return jsonResponse({ error: "Você atingiu o limite de 2 gerações gratuitas. Assine o plano premium para uso ilimitado." }, 429);
    }

    const { pillar, pillarLabel, weeklyTheme, dayTitle, day, primaryNiche, contentStyle, visceralElement } = await req.json();
    console.log("[daily-guide] start", { userId, day, pillar, isPremium, currentCount });

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) {
      console.error("[daily-guide] missing GOOGLE_GEMINI_API_KEY");
      return jsonResponse({ error: "Configuração do servidor incompleta (chave da IA ausente)." }, 500);
    }

    let visceralContext = "";

    if (audienceData?.avatar_profile) {
      const ap = audienceData.avatar_profile as Record<string, unknown>;
      visceralContext = `\n\nPERFIL DO PÚBLICO (use em todas as categorias):\nAvatar: ${ap.avatar || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto: ${ap.deepOccultDesire || ''}\nFeridas centrais: ${JSON.stringify(ap.coreWounds || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}`;
    }

    const styleMap: Record<string, string> = { casual: "leve, descontraído, como conversa entre amigos", profissional: "autoritário, informativo, com dados e dicas práticas", divertido: "engraçado, irreverente, usando memes e trends" };
    const styleDesc = styleMap[contentStyle] || styleMap.casual;
    const nicheContext = primaryNiche ? `O nicho principal do(a) criador(a) de conteúdo é: ${primaryNiche}.` : '';
    const visceralInstruction = visceralElement ? `\n\nGATILHO VISCERAL OBRIGATÓRIO PARA ESTE DIA: ${visceralElement} — base emocional dos hooks, storytelling, CTAs e cliffhangers.` : "";

    const systemPrompt = `Você é especialista em marketing digital para criadores de conteúdo brasileiros. Use linguagem neutra de gênero.\n${nicheContext}\nEstilo: ${styleDesc}.${visceralContext}${visceralInstruction}\nGere conteúdo autêntico, pessoal e que soe natural.\nConteúdo é para o nicho "${pillarLabel}" no dia "${dayTitle}". Tema semanal: "${weeklyTheme}".\nAdapte TODO o conteúdo ao nicho "${primaryNiche || 'lifestyle'}".`;

    const userPrompt = `Gere conteúdo para o dia ${day}.\nPilar: ${pillarLabel} (${pillar})\nTítulo do dia: ${dayTitle}\nNicho: ${primaryNiche || 'lifestyle'}\n\nGere as 7 categorias:\n1. contentTypes: 5 tipos\n2. hooks: 5 hooks virais\n3. videoFormats: 5 formatos\n4. storytelling: 5 ideias\n5. ctas: 5 CTAs\n6. cliffhangers: 5 cliffhangers\n7. taskExamples: objeto com 7 chaves (morningInsight, morningPoll, reel, reelEngagement, valueStories, lifestyleStory, feedPost), cada uma com array de EXATAMENTE 5 exemplos PRÁTICOS, prontos para uso, no nicho "${primaryNiche || 'lifestyle'}".\n\nRetorne EXATAMENTE no formato da function tool.`;

    const startedAt = Date.now();
    const response = await callGeminiResilient({
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      tools: [{ type: "function", function: { name: "generate_daily_content", description: "Generate personalized daily content", parameters: { type: "object", properties: { contentTypes: { type: "array", items: { type: "string" } }, hooks: { type: "array", items: { type: "string" } }, videoFormats: { type: "array", items: { type: "string" } }, storytelling: { type: "array", items: { type: "string" } }, ctas: { type: "array", items: { type: "string" } }, cliffhangers: { type: "array", items: { type: "string" } }, taskExamples: { type: "object", properties: { morningInsight: { type: "array", items: { type: "string" } }, morningPoll: { type: "array", items: { type: "string" } }, reel: { type: "array", items: { type: "string" } }, reelEngagement: { type: "array", items: { type: "string" } }, valueStories: { type: "array", items: { type: "string" } }, lifestyleStory: { type: "array", items: { type: "string" } }, feedPost: { type: "array", items: { type: "string" } } }, required: ["morningInsight", "morningPoll", "reel", "reelEngagement", "valueStories", "lifestyleStory", "feedPost"] } }, required: ["contentTypes", "hooks", "videoFormats", "storytelling", "ctas", "cliffhangers", "taskExamples"], additionalProperties: false } } }],
      tool_choice: { type: "function", function: { name: "generate_daily_content" } },
      max_tokens: 2500,
    }, GOOGLE_GEMINI_API_KEY, "daily-guide");
    const latencyMs = Date.now() - startedAt;
    console.log("[daily-guide] gemini responded", { userId, status: response.status, latencyMs });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[daily-guide] gemini error", { status: response.status, body: text.slice(0, 500) });
      if (response.status === 429) return jsonResponse({ error: "Muitas requisições à IA. Aguarde alguns segundos." }, 429);
      if (response.status === 402) return jsonResponse({ error: "Créditos da IA esgotados. Avise o administrador." }, 402);
      if (response.status === 503) return jsonResponse({ error: "O serviço de IA do Google está instável agora (Gemini 503). Aguarde 1-2 minutos e tente novamente." }, 503);
      return jsonResponse({ error: "A IA está demorando mais que o normal. Tente novamente em alguns segundos." }, 504);
    }

    const data = await response.json().catch((e) => {
      console.error("[daily-guide] failed to parse gemini json envelope", e);
      return null;
    });
    if (!data) return jsonResponse({ error: "A IA retornou resposta inválida. Tente novamente." }, 502);

    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      console.error("[daily-guide] no tool_calls in response", {
        finishReason: data?.choices?.[0]?.finish_reason,
        messageKeys: Object.keys(data?.choices?.[0]?.message || {}),
        sample: JSON.stringify(data).slice(0, 800),
      });
      return jsonResponse({ error: "A IA retornou resposta sem dados estruturados. Tente novamente." }, 502);
    }

    let content: Record<string, unknown>;
    try {
      content = parseLooseJson(args);
    } catch (e) {
      console.error("[daily-guide] failed to parse tool arguments JSON", { sample: String(args).slice(0, 500), err: String(e) });
      return jsonResponse({ error: "A IA retornou JSON inválido. Tente novamente." }, 502);
    }

    // Sucesso: agora sim contabiliza uso
    try {
      await Promise.all([
        adminClient.from("user_usage").update({
          tool_generations: currentCount + 1,
          last_tool_date: today,
        }).eq("user_id", userId),
        adminClient.from("usage_logs").insert({ user_id: userId, feature: "daily_guide" }),
      ]);
    } catch (e) {
      console.warn("[daily-guide] usage update failed (non-fatal)", e);
    }

    console.log("[daily-guide] success", { userId, day, latencyMs });
    return jsonResponse(content);
  } catch (e) {
    console.error("[daily-guide] uncaught error:", e, { userId });
    const isAbort = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
    return jsonResponse(
      { error: isAbort ? "A IA está demorando mais que o normal. Tente novamente em alguns segundos." : (e instanceof Error ? e.message : "Erro interno") },
      isAbort ? 504 : 500
    );
  }
});
