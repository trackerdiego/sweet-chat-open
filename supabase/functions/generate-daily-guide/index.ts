import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      visceralContext = `\n\n═══════════════════════════════════════════════════════════\nPERFIL PSICOLÓGICO DO PÚBLICO — USE EM CADA CATEGORIA\n═══════════════════════════════════════════════════════════\n\nAvatar: ${ap.avatar || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto profundo: ${ap.deepOccultDesire || ''}\nInimigo comum: ${ap.commonEnemy || ''}\nQueixa principal: ${ap.primaryComplaint || ''}\nGap de autoimagem: ${ap.selfImageGap || ''}\n\nFeridas centrais: ${JSON.stringify(ap.coreWounds || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nGatilhos de vergonha: ${JSON.stringify(ap.shameTriggers || [])}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\nObjeções: ${JSON.stringify(ap.objections || [])}\nÂncoras de esperança: ${JSON.stringify(ap.hopeAnchors || [])}\nGatilhos de decisão: ${JSON.stringify(ap.decisionTriggers || [])}\nDrivers de ansiedade: ${JSON.stringify(ap.anxietyDrivers || [])}\nÂncoras de identidade: ${JSON.stringify(ap.identityAnchors || [])}\nRelatabilidade do cotidiano: ${JSON.stringify(ap.everydayRelatability || [])}\nFalsas soluções já tentadas: ${JSON.stringify(ap.falseSolutions || [])}\n\nINSTRUÇÕES POR CATEGORIA:\n- HOOKS: Use "shameTriggers" e "verbalTriggers"\n- STORYTELLING: Explore "coreWounds", "frustrations" e "everydayRelatability"\n- CTAS: Use "decisionTriggers" e "hopeAnchors"\n- CLIFFHANGERS: Toque nos "anxietyDrivers" e no "deepOccultDesire"\n- VIDEO FORMATS: Adapte formatos que permitam explorar "falseSolutions" e "commonEnemy"\n- CONTENT TYPES: Escolha tipos que permitam trabalhar "identityAnchors" e "mistakenBeliefs"\n═══════════════════════════════════════════════════════════`;
    }

    const styleMap: Record<string, string> = { casual: "leve, descontraído, como conversa entre amigos", profissional: "autoritário, informativo, com dados e dicas práticas", divertido: "engraçado, irreverente, usando memes e trends" };
    const styleDesc = styleMap[contentStyle] || styleMap.casual;
    const nicheContext = primaryNiche ? `O nicho principal do(a) criador(a) de conteúdo é: ${primaryNiche}.` : '';
    const visceralInstruction = visceralElement ? `\n\nGATILHO VISCERAL OBRIGATÓRIO PARA ESTE DIA: ${visceralElement}\n- HOOKS: devem ativar EXATAMENTE este gatilho\n- STORYTELLING: deve explorar o tema emocional deste gatilho\n- CTAS: devem conectar este gatilho à transformação\n- CLIFFHANGERS: devem criar tensão usando este gatilho\n- NÃO ignore — é a base emocional do dia` : "";

    const systemPrompt = `Você é especialista em marketing digital para criadores de conteúdo brasileiros. Use linguagem neutra de gênero.\n${nicheContext}\nO estilo de comunicação é: ${styleDesc}.\n${visceralContext}${visceralInstruction}\nGere conteúdo autêntico, pessoal e que soe natural.\nO conteúdo é para um(a) criador(a) de conteúdo do nicho de "${pillarLabel}" no dia "${dayTitle}".\nTema semanal: "${weeklyTheme}".\nAdapte TODO o conteúdo ao nicho "${primaryNiche || 'lifestyle'}".`;

    const userPrompt = `Gere conteúdo personalizado para o dia ${day} da jornada de 30 dias.\nPilar: ${pillarLabel} (${pillar})\nTema semanal: ${weeklyTheme}\nTítulo do dia: ${dayTitle}\nNicho: ${primaryNiche || 'lifestyle'}\n\nGere TODAS as 7 categorias de conteúdo:\n1. contentTypes: 5 tipos de conteúdo\n2. hooks: 5 hooks virais\n3. videoFormats: 5 formatos de vídeo\n4. storytelling: 5 ideias de storytelling\n5. ctas: 5 CTAs de conversão\n6. cliffhangers: 5 opções de cliffhanger\n7. taskExamples: objeto com 7 chaves (morningInsight, morningPoll, reel, reelEngagement, valueStories, lifestyleStory, feedPost), cada uma com array de 5 exemplos PRÁTICOS e ESPECÍFICOS para o nicho "${primaryNiche || 'lifestyle'}". Cada exemplo deve ser uma frase pronta que o criador pode usar diretamente. Use os gatilhos psicológicos do perfil visceral do público para tornar cada exemplo emocionalmente impactante.\n\nRetorne EXATAMENTE no formato pedido pela function tool.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        tools: [{ type: "function", function: { name: "generate_daily_content", description: "Generate personalized daily content", parameters: { type: "object", properties: { contentTypes: { type: "array", items: { type: "string" } }, hooks: { type: "array", items: { type: "string" } }, videoFormats: { type: "array", items: { type: "string" } }, storytelling: { type: "array", items: { type: "string" } }, ctas: { type: "array", items: { type: "string" } }, cliffhangers: { type: "array", items: { type: "string" } }, taskExamples: { type: "object", properties: { morningInsight: { type: "array", items: { type: "string" } }, morningPoll: { type: "array", items: { type: "string" } }, reel: { type: "array", items: { type: "string" } }, reelEngagement: { type: "array", items: { type: "string" } }, valueStories: { type: "array", items: { type: "string" } }, lifestyleStory: { type: "array", items: { type: "string" } }, feedPost: { type: "array", items: { type: "string" } } }, required: ["morningInsight", "morningPoll", "reel", "reelEngagement", "valueStories", "lifestyleStory", "feedPost"] } }, required: ["contentTypes", "hooks", "videoFormats", "storytelling", "ctas", "cliffhangers", "taskExamples"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "generate_daily_content" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Erro ao gerar conteúdo" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No tool call response from AI");
    const content = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(content), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-daily-guide error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});