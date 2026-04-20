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
  // strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  // try direct parse
  try { return JSON.parse(s); } catch { /* fall through */ }
  // remove control chars + trailing commas, then retry
  const cleaned = s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(cleaned);
}

// === Model config (locked) ===
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-pro";
const TIMEOUT_MS = 90000;
const RETRIABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const ALLOWED_MODELS = new Set(["gemini-2.5-pro", "gemini-2.5-flash"]);
if (!ALLOWED_MODELS.has(PRIMARY_MODEL) || !ALLOWED_MODELS.has(FALLBACK_MODEL)) {
  console.error("[generate-script] BOOT GUARD FAILED — modelo deprecated configurado", { PRIMARY_MODEL, FALLBACK_MODEL });
}
console.log("[generate-script] boot", { PRIMARY_MODEL, FALLBACK_MODEL, TIMEOUT_MS });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGeminiResilient(
  body: Record<string, unknown>,
  apiKey: string,
  tag: string,
  timeoutMs = TIMEOUT_MS,
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

  // backoff: 1s, 3s, 7s (with light jitter)
  const delays = [1000, 3000, 7000];
  const tryModel = async (model: string): Promise<Response | null> => {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await attempt(model);
        if (!RETRIABLE_STATUSES.has(r.status)) {
          // Peek body to detect Gemini's MALFORMED_FUNCTION_CALL (200 OK but unusable)
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
  // Último recurso: devolve um Response 503 sintético pra fluxo padrão tratar.
  return new Response(JSON.stringify({ error: { message: "All Gemini attempts failed (primary + fallback)" } }), { status: 503 });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let userId: string | null = null;

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

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const t0 = Date.now();
    const [usageRes, audienceRes] = await Promise.all([
      adminClient.from("user_usage").select("is_premium, script_generations, last_script_date").eq("user_id", userId).maybeSingle(),
      supabaseAuth.from("audience_profiles").select("avatar_profile").eq("user_id", userId).maybeSingle(),
    ]);
    const usageData = usageRes.data;
    const audienceData = audienceRes.data;
    console.log("[generate-script] db parallel fetch", { userId, ms: Date.now() - t0 });

    const isPremium = usageData?.is_premium ?? false;
    const today = new Date().toISOString().slice(0, 10);
    const isNewDay = usageData?.last_script_date !== today;
    const scriptCount = isNewDay ? 0 : (usageData?.script_generations ?? 0);

    if (!isPremium && scriptCount >= 3) {
      return jsonResponse({ error: "Você atingiu o limite de 3 scripts por dia. Assine o plano premium para uso ilimitado." }, 429);
    }

    const { day, title, pillar, pillarLabel, viralHook, storytellingBody, subtleConversion, primaryNiche, contentStyle, visceralElement } = await req.json();
    console.log("[generate-script] start", { userId, day, pillar, isPremium, scriptCount });

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) {
      console.error("[generate-script] missing GOOGLE_GEMINI_API_KEY");
      return jsonResponse({ error: "Configuração do servidor incompleta (chave da IA ausente)." }, 500);
    }

    let visceralContext = "";
    if (audienceData?.avatar_profile) {
      const ap = audienceData.avatar_profile as Record<string, unknown>;
      visceralContext = `\n\nPERFIL PSICOLÓGICO DO PÚBLICO\nAvatar: ${ap.avatar || ''}\nObjetivo principal: ${ap.primaryGoal || ''}\nQueixa principal: ${ap.primaryComplaint || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto profundo: ${ap.deepOccultDesire || ''}\nInimigo comum: ${ap.commonEnemy || ''}\nGap de autoimagem: ${ap.selfImageGap || ''}\nFeridas centrais: ${JSON.stringify(ap.coreWounds || [])}\nObjeções: ${JSON.stringify(ap.objections || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nGatilhos de vergonha: ${JSON.stringify(ap.shameTriggers || [])}\nÂncoras de esperança: ${JSON.stringify(ap.hopeAnchors || [])}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\nFalsas soluções: ${JSON.stringify(ap.falseSolutions || [])}\n\nINSTRUÇÕES:\nHOOK: ative shameTriggers/coreWounds, use verbalTriggers\nSTORYTELLING: explore frustrations, falseSolutions, commonEnemy, selfImageGap\nCTA: fale ao deepOccultDesire, use hopeAnchors`;
    }

    const styleMap: Record<string, string> = { casual: "leve, descontraído", profissional: "autoritário, informativo", divertido: "engraçado, irreverente" };
    const styleDesc = styleMap[contentStyle] || styleMap.casual;
    const nicheContext = primaryNiche ? `\nO nicho principal do(a) criador(a) de conteúdo é: ${primaryNiche}.` : '';
    const visceralInstruction = visceralElement ? `\n\nGATILHO VISCERAL OBRIGATÓRIO: ${visceralElement}\n- O HOOK deve ativar EXATAMENTE este gatilho\n- O STORYTELLING deve explorar este tema emocional\n- O CTA deve conectar este gatilho à transformação` : "";

    const systemPrompt = `Você é copywriter especialista em conteúdo para criadores de conteúdo brasileiros. Use linguagem neutra de gênero.${nicheContext}\nEstilo: ${styleDesc}.\n${visceralContext}${visceralInstruction}\n\nRegras: Linguagem natural e coloquial em PT-BR. Hooks com curiosidade imediata. Storytelling pessoal e emocional. CTA sutil. Adapte ao nicho "${primaryNiche || 'lifestyle'}". Cada script deve ser ÚNICO.`;

    const userPrompt = `Crie uma versão NOVA e MELHORADA do script para o Dia ${day}.\nPilar: ${pillarLabel} (${pillar})\nTítulo: ${title}\n${visceralElement ? `GATILHO VISCERAL: ${visceralElement}\n` : ""}Script de referência (NÃO copie):\n- Hook: ${viralHook}\n- Corpo: ${storytellingBody}\n- CTA: ${subtleConversion}\n\nGere script completamente novo. Adapte ao nicho "${primaryNiche || 'lifestyle'}".`;

    const startedAt = Date.now();
    const response = await callGeminiResilient({
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      tools: [{ type: "function", function: { name: "generate_script", description: "Retorna script estruturado", parameters: { type: "object", properties: { viralHook: { type: "string" }, storytellingBody: { type: "string" }, subtleConversion: { type: "string" } }, required: ["viralHook", "storytellingBody", "subtleConversion"], additionalProperties: false } } }],
      tool_choice: { type: "function", function: { name: "generate_script" } },
      max_tokens: 2000,
    }, GOOGLE_GEMINI_API_KEY, "generate-script");
    const latencyMs = Date.now() - startedAt;
    console.log("[generate-script] gemini responded", { userId, status: response.status, latencyMs });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[generate-script] gemini error", { status: response.status, body: text.slice(0, 500) });
      if (response.status === 429) return jsonResponse({ error: "Muitas requisições à IA. Aguarde alguns segundos." }, 429);
      if (response.status === 402) return jsonResponse({ error: "Créditos da IA esgotados. Avise o administrador." }, 402);
      if (response.status === 503) return jsonResponse({ error: "O serviço de IA do Google está instável agora (Gemini 503). Aguarde 1-2 minutos e tente novamente." }, 503);
      return jsonResponse({ error: "A IA está demorando mais que o normal. Tente novamente em alguns segundos." }, 504);
    }

    const data = await response.json().catch((e) => {
      console.error("[generate-script] failed to parse gemini json envelope", e);
      return null;
    });
    if (!data) return jsonResponse({ error: "A IA retornou resposta inválida. Tente novamente." }, 502);

    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      console.error("[generate-script] no tool_calls in response", {
        finishReason: data?.choices?.[0]?.finish_reason,
        messageKeys: Object.keys(data?.choices?.[0]?.message || {}),
        sample: JSON.stringify(data).slice(0, 800),
      });
      return jsonResponse({ error: "A IA retornou resposta sem dados estruturados. Tente novamente." }, 502);
    }

    let script: Record<string, unknown>;
    try {
      script = parseLooseJson(args);
    } catch (e) {
      console.error("[generate-script] failed to parse tool arguments JSON", { sample: String(args).slice(0, 500), err: String(e) });
      return jsonResponse({ error: "A IA retornou JSON inválido. Tente novamente." }, 502);
    }

    if (!script.viralHook || !script.storytellingBody || !script.subtleConversion) {
      console.error("[generate-script] script missing required fields", { keys: Object.keys(script) });
      return jsonResponse({ error: "A IA retornou um script incompleto. Tente novamente." }, 502);
    }

    // Sucesso: agora sim contabiliza uso
    try {
      await Promise.all([
        adminClient.from("user_usage").update({
          script_generations: scriptCount + 1,
          last_script_date: today,
        }).eq("user_id", userId),
        adminClient.from("usage_logs").insert({ user_id: userId, feature: "script" }),
      ]);
    } catch (e) {
      console.warn("[generate-script] usage update failed (non-fatal)", e);
    }

    console.log("[generate-script] success", { userId, day, latencyMs });
    return jsonResponse(script);
  } catch (e) {
    console.error("[generate-script] uncaught error:", e, { userId });
    const isAbort = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
    return jsonResponse(
      { error: isAbort ? "A IA está demorando mais que o normal. Tente novamente em alguns segundos." : (e instanceof Error ? e.message : "Erro interno") },
      isAbort ? 504 : 500
    );
  }
});
