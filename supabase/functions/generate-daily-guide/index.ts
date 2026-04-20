import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: usageData } = await adminClient
      .from("user_usage")
      .select("is_premium, tool_generations, last_tool_date")
      .eq("user_id", userId)
      .maybeSingle();

    const isPremium = usageData?.is_premium ?? false;
    const today = new Date().toISOString().split("T")[0];
    const isNewDay = usageData?.last_tool_date !== today;
    const currentCount = isNewDay ? 0 : (usageData?.tool_generations ?? 0);

    if (!isPremium && currentCount >= 2) {
      return new Response(
        JSON.stringify({ error: "Você atingiu o limite de 2 gerações gratuitas. Assine o plano premium para uso ilimitado." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await Promise.all([
      adminClient.from("user_usage").update({
        tool_generations: currentCount + 1,
        last_tool_date: today,
      }).eq("user_id", userId),
      adminClient.from("usage_logs").insert({ user_id: userId, feature: "daily_guide" }),
    ]);

    const { pillar, pillarLabel, weeklyTheme, dayTitle, day, primaryNiche, contentStyle, visceralElement } = await req.json();
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    let visceralContext = "";
    const { data: audienceData } = await supabaseAuth
      .from("audience_profiles")
      .select("avatar_profile")
      .eq("user_id", userId)
      .maybeSingle();

    if (audienceData?.avatar_profile) {
      const ap = audienceData.avatar_profile as Record<string, unknown>;
      // Enxuto: 6 campos chave em vez de 15+
      visceralContext = `\n\nPERFIL DO PÚBLICO (use em todas as categorias):\nAvatar: ${ap.avatar || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto: ${ap.deepOccultDesire || ''}\nFeridas centrais: ${JSON.stringify(ap.coreWounds || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}`;
    }

    const styleMap: Record<string, string> = { casual: "leve, descontraído, como conversa entre amigos", profissional: "autoritário, informativo, com dados e dicas práticas", divertido: "engraçado, irreverente, usando memes e trends" };
    const styleDesc = styleMap[contentStyle] || styleMap.casual;
    const nicheContext = primaryNiche ? `O nicho principal do(a) criador(a) de conteúdo é: ${primaryNiche}.` : '';
    const visceralInstruction = visceralElement ? `\n\nGATILHO VISCERAL OBRIGATÓRIO PARA ESTE DIA: ${visceralElement} — base emocional dos hooks, storytelling, CTAs e cliffhangers.` : "";

    const systemPrompt = `Você é especialista em marketing digital para criadores de conteúdo brasileiros. Use linguagem neutra de gênero.\n${nicheContext}\nEstilo: ${styleDesc}.${visceralContext}${visceralInstruction}\nGere conteúdo autêntico, pessoal e que soe natural.\nConteúdo é para o nicho "${pillarLabel}" no dia "${dayTitle}". Tema semanal: "${weeklyTheme}".\nAdapte TODO o conteúdo ao nicho "${primaryNiche || 'lifestyle'}".`;

    const userPrompt = `Gere conteúdo para o dia ${day}.\nPilar: ${pillarLabel} (${pillar})\nTítulo do dia: ${dayTitle}\nNicho: ${primaryNiche || 'lifestyle'}\n\nGere as 7 categorias:\n1. contentTypes: 5 tipos\n2. hooks: 5 hooks virais\n3. videoFormats: 5 formatos\n4. storytelling: 5 ideias\n5. ctas: 5 CTAs\n6. cliffhangers: 5 cliffhangers\n7. taskExamples: objeto com 7 chaves (morningInsight, morningPoll, reel, reelEngagement, valueStories, lifestyleStory, feedPost), cada uma com array de 3 exemplos PRÁTICOS, prontos para uso, no nicho "${primaryNiche || 'lifestyle'}".\n\nRetorne EXATAMENTE no formato da function tool.`;

    const response = await callGeminiWithRetry({
      model: "gemini-2.5-flash",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      tools: [{ type: "function", function: { name: "generate_daily_content", description: "Generate personalized daily content", parameters: { type: "object", properties: { contentTypes: { type: "array", items: { type: "string" } }, hooks: { type: "array", items: { type: "string" } }, videoFormats: { type: "array", items: { type: "string" } }, storytelling: { type: "array", items: { type: "string" } }, ctas: { type: "array", items: { type: "string" } }, cliffhangers: { type: "array", items: { type: "string" } }, taskExamples: { type: "object", properties: { morningInsight: { type: "array", items: { type: "string" } }, morningPoll: { type: "array", items: { type: "string" } }, reel: { type: "array", items: { type: "string" } }, reelEngagement: { type: "array", items: { type: "string" } }, valueStories: { type: "array", items: { type: "string" } }, lifestyleStory: { type: "array", items: { type: "string" } }, feedPost: { type: "array", items: { type: "string" } } }, required: ["morningInsight", "morningPoll", "reel", "reelEngagement", "valueStories", "lifestyleStory", "feedPost"] } }, required: ["contentTypes", "hooks", "videoFormats", "storytelling", "ctas", "cliffhangers", "taskExamples"], additionalProperties: false } } }],
      tool_choice: { type: "function", function: { name: "generate_daily_content" } },
    }, GOOGLE_GEMINI_API_KEY);

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "A IA está demorando mais que o normal. Tente novamente em alguns segundos." }), { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No tool call response from AI");
    const content = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(content), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-daily-guide error:", e);
    const isAbort = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
    return new Response(
      JSON.stringify({ error: isAbort ? "A IA está demorando mais que o normal. Tente novamente em alguns segundos." : (e instanceof Error ? e.message : "Unknown error") }),
      { status: isAbort ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
