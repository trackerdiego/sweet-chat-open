import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = user.id;

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: usageData } = await adminClient.from("user_usage").select("is_premium, script_generations, last_script_date").eq("user_id", userId).maybeSingle();
    const isPremium = usageData?.is_premium ?? false;
    const today = new Date().toISOString().slice(0, 10);
    const scriptCount = (usageData?.last_script_date === today) ? (usageData?.script_generations ?? 0) : 0;
    if (!isPremium && scriptCount >= 3) return new Response(JSON.stringify({ error: "Você atingiu o limite de 3 scripts por dia. Assine o plano premium para uso ilimitado." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const newCount = (usageData?.last_script_date === today) ? scriptCount + 1 : 1;
    await Promise.all([
      adminClient.from("user_usage").update({ script_generations: newCount, last_script_date: today }).eq("user_id", userId),
      adminClient.from("usage_logs").insert({ user_id: userId, feature: "script" }),
    ]);

    const { day, title, pillar, pillarLabel, viralHook, storytellingBody, subtleConversion, primaryNiche, contentStyle, visceralElement } = await req.json();
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    let visceralContext = "";
    const { data: audienceData } = await supabaseAuth.from("audience_profiles").select("avatar_profile").eq("user_id", userId).maybeSingle();
    if (audienceData?.avatar_profile) {
      const ap = audienceData.avatar_profile as Record<string, unknown>;
      visceralContext = `\n\n═══════════════════════════════════════════════════════════\nPERFIL PSICOLÓGICO COMPLETO DO PÚBLICO\n═══════════════════════════════════════════════════════════\n\nAvatar: ${ap.avatar || ''}\nObjetivo principal: ${ap.primaryGoal || ''}\nQueixa principal: ${ap.primaryComplaint || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto profundo: ${ap.deepOccultDesire || ''}\nInimigo comum: ${ap.commonEnemy || ''}\nGap de autoimagem: ${ap.selfImageGap || ''}\n\nFeridas centrais: ${JSON.stringify(ap.coreWounds || [])}\nObjeções: ${JSON.stringify(ap.objections || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nGatilhos de vergonha: ${JSON.stringify(ap.shameTriggers || [])}\nÂncoras de esperança: ${JSON.stringify(ap.hopeAnchors || [])}\nGatilhos de decisão: ${JSON.stringify(ap.decisionTriggers || [])}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\nCrenças equivocadas: ${JSON.stringify(ap.mistakenBeliefs || [])}\nDrivers de ansiedade: ${JSON.stringify(ap.anxietyDrivers || [])}\nÂncoras de identidade: ${JSON.stringify(ap.identityAnchors || [])}\nRelatabilidade do cotidiano: ${JSON.stringify(ap.everydayRelatability || [])}\nFalsas soluções: ${JSON.stringify(ap.falseSolutions || [])}\n\n7 Pecados (Dor atual): ${JSON.stringify(ap.sevenSinsCurrent || {})}\n7 Pecados (Motivação oculta): ${JSON.stringify(ap.sevenSinsFuture || {})}\n\nINSTRUÇÕES POR SEÇÃO:\nHOOK: ATIVE shameTriggers/coreWounds, use verbalTriggers\nSTORYTELLING: Explore frustrations, falseSolutions, commonEnemy, selfImageGap\nCTA: Fale ao deepOccultDesire, use hopeAnchors, ative decisionTriggers\n═══════════════════════════════════════════════════════════`;
    }

    const styleMap: Record<string, string> = { casual: "leve, descontraído", profissional: "autoritário, informativo", divertido: "engraçado, irreverente" };
    const styleDesc = styleMap[contentStyle] || styleMap.casual;
    const nicheContext = primaryNiche ? `\nO nicho principal do(a) criador(a) de conteúdo é: ${primaryNiche}.` : '';
    const visceralInstruction = visceralElement ? `\n\nGATILHO VISCERAL OBRIGATÓRIO: ${visceralElement}\n- O HOOK deve ativar EXATAMENTE este gatilho\n- O STORYTELLING deve explorar este tema emocional\n- O CTA deve conectar este gatilho à transformação` : "";

    const systemPrompt = `Você é um(a) copywriter especialista em conteúdo para criadores de conteúdo brasileiros. Use linguagem neutra de gênero.${nicheContext}\nEstilo: ${styleDesc}.\n${visceralContext}${visceralInstruction}\n\nRegras: Linguagem natural e coloquial em PT-BR. Hooks com curiosidade imediata. Storytelling pessoal e emocional. CTA sutil. Adapte ao nicho "${primaryNiche || 'lifestyle'}". Cada script deve ser ÚNICO.`;

    const userPrompt = `Crie uma versão NOVA e MELHORADA do script para o Dia ${day}.\nPilar: ${pillarLabel} (${pillar})\nTítulo: ${title}\n${visceralElement ? `GATILHO VISCERAL: ${visceralElement}\n` : ""}Script de referência (NÃO copie):\n- Hook: ${viralHook}\n- Corpo: ${storytellingBody}\n- CTA: ${subtleConversion}\n\nGere script completamente novo. Adapte ao nicho "${primaryNiche || 'lifestyle'}".`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        tools: [{ type: "function", function: { name: "generate_script", description: "Retorna script estruturado", parameters: { type: "object", properties: { viralHook: { type: "string" }, storytellingBody: { type: "string" }, subtleConversion: { type: "string" } }, required: ["viralHook", "storytellingBody", "subtleConversion"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "generate_script" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido.", retryable: true }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const text = await response.text(); console.error("AI error:", response.status, text);
      return new Response(JSON.stringify({ error: "Erro ao gerar script" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("Resposta da IA sem dados estruturados");
    const script = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(script), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});