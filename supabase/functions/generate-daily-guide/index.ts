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

console.log("[daily-guide] boot — staggered A+B (800ms), responseSchema");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let userId: string | null = null;
  let adminClient: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Não autorizado" }, 401);

    const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Não autorizado" }, 401);
    userId = user.id;

    adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
    if (!GOOGLE_GEMINI_API_KEY) return jsonResponse({ error: "Configuração do servidor incompleta (chave da IA ausente)." }, 500);

    let visceralContext = "";
    if (audienceData?.avatar_profile) {
      const ap = audienceData.avatar_profile as Record<string, unknown>;
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

    const startedAt = Date.now();
    const [resA, resB] = await Promise.allSettled([
      callGeminiNative({ apiKey: GOOGLE_GEMINI_API_KEY, systemInstruction: baseSystem, prompt: promptA, schema: schemaA, tag: "daily-guide-A", maxOutputTokens: 1800, timeoutMs: 60000 }),
      new Promise((r) => setTimeout(r, 800)).then(() =>
        callGeminiNative({ apiKey: GOOGLE_GEMINI_API_KEY, systemInstruction: baseSystem, prompt: promptB, schema: schemaB, tag: "daily-guide-B", maxOutputTokens: 2200, timeoutMs: 60000 })
      ),
    ]);

    if (resA.status === "rejected") {
      const e = resA.reason;
      console.error("[daily-guide] call A failed", e);
      if (e instanceof GeminiError) {
        if (e.status === 429) return jsonResponse({ error: "Muitas requisições à IA. Aguarde alguns segundos." }, 429);
        if (e.status === 402) return jsonResponse({ error: "Créditos da IA esgotados." }, 402);
        return jsonResponse({ error: "Serviço de IA instável. Tente novamente em 1-2 minutos." }, 503);
      }
      return jsonResponse({ error: "Erro ao gerar guia diário." }, 500);
    }

    const partA = resA.value.json as Record<string, unknown>;
    const taskExamples: Record<string, unknown> = resB.status === "fulfilled" ? (resB.value.json as Record<string, unknown>) : {};
    if (resB.status === "rejected") console.warn("[daily-guide] call B falhou — sem taskExamples", resB.reason);

    const content = { ...partA, taskExamples };

    try {
      await Promise.all([
        adminClient.from("user_usage").update({ tool_generations: currentCount + 1, last_tool_date: today }).eq("user_id", userId),
        adminClient.from("usage_logs").insert({ user_id: userId, feature: "daily_guide" }),
      ]);
    } catch (e) {
      console.warn("[daily-guide] usage update failed (non-fatal)", e);
    }

    console.log("[daily-guide] success", { userId, day, totalMs: Date.now() - startedAt, hasTaskExamples: Object.keys(taskExamples).length > 0 });
    return jsonResponse(content);
  } catch (e) {
    console.error("[daily-guide] uncaught error:", e, { userId });
    const isAbort = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
    return jsonResponse({ error: isAbort ? "A IA está demorando mais que o normal. Tente novamente." : (e instanceof Error ? e.message : "Erro interno") }, isAbort ? 504 : 500);
  }
});
