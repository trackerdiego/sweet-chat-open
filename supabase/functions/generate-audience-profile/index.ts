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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { primaryNiche, secondaryNiches, contentStyle } = await req.json();

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const secondaryList = (secondaryNiches || []).join(", ");
    const styleMap: Record<string, string> = {
      casual: "leve, descontraído, como conversa entre amigos",
      profissional: "autoritário, informativo, com dados e dicas práticas",
      divertido: "engraçado, irreverente, usando memes e trends",
    };
    const styleDesc = styleMap[contentStyle] || styleMap.casual;

    console.log("Step 1: Generating audience description...");

    const step1Response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é uma estrategista de público digital especialista em criadores(as) de conteúdo brasileiros(as). Crie uma descrição rica e detalhada do público-alvo ideal. Use linguagem neutra de gênero — NUNCA use termos exclusivamente femininos ou masculinos. Use formas neutras ou com barra (criador/a, autêntico/a).`
          },
          {
            role: "user",
            content: `Crie uma descrição detalhada do público-alvo ideal para um(a) criador(a) de conteúdo brasileiro(a) com base nesta descrição:\n\n${primaryNiche}\n\n${secondaryList ? `Interesses complementares: ${secondaryList}` : ''}\nEstilo de comunicação: ${styleDesc}\n\nA descrição deve incluir:\n- Quem são essas pessoas (demografia, psicografia)\n- O que consomem de conteúdo\n- Quais suas principais dores e frustrações\n- Quais seus desejos e aspirações\n- Como se comportam nas redes sociais\n- O que as motiva a seguir criadores(as) de conteúdo\n- Qual transformação buscam\n\nSeja específico(a), visceral e profundo(a). Nada genérico.`
          },
        ],
      }),
    });

    if (!step1Response.ok) {
      const errText = await step1Response.text();
      console.error("Step 1 error:", step1Response.status, errText);
      throw new Error(`Erro na etapa 1: ${step1Response.status}`);
    }

    const step1Data = await step1Response.json();
    const audienceDescription = step1Data.choices?.[0]?.message?.content || "";

    if (!audienceDescription) {
      throw new Error("Etapa 1 não retornou descrição do público");
    }

    console.log("Step 1 complete. Description length:", audienceDescription.length);

    console.log("Step 2: Generating visceral avatar profile...");

    const avatarSystemPrompt = `Act as a Master Copywriter and Direct Response Strategist, specializing in deep psychology and consumer behavior. Your language must be visceral, real, and dimensional. You do not tolerate vague or superficial answers.\n\nYour mission is to build the most robust and compelling Avatar Profile possible, based on the product/audience information below. You must analyze and fill in ALL of the following fields in ONE SINGLE RESPONSE.\n\nUse your vast knowledge base to infer realistic details, going beyond the obvious. I do not want generic answers. I want the psychological truth behind this avatar.\n\nExecute each step with precision, creating an irresistible communication framework that resonates deeply with the target audience.\n\nCRITICAL INSTRUCTION: All of your answers and all output must be in Native Brazilian Portuguese (Português Nativo do Brasil). Use linguagem neutra de gênero — NUNCA use termos exclusivamente femininos ou masculinos. Use formas neutras ou com barra (criador/a, autêntico/a, inspirado/a).`;

    const avatarUserPrompt = `[Product/Audience]= Criador(a) de conteúdo digital brasileiro(a). Descrição do negócio/conteúdo:\n"${primaryNiche}"\n${secondaryList ? `Interesses complementares: ${secondaryList}` : ''}\nEstilo de comunicação: ${styleDesc}.\n\nDescrição detalhada do público-alvo:\n${audienceDescription}\n\nCom base nessas informações, preencha o perfil completo do avatar usando a tool fornecida. Seja visceral, profundo(a) e específico(a). NADA genérico.`;

    const step2Response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-pro",
        messages: [
          { role: "system", content: avatarSystemPrompt },
          { role: "user", content: avatarUserPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_avatar_profile",
              description: "Salva o perfil psicológico completo do avatar/público-alvo",
              parameters: {
                type: "object",
                properties: {
                  niche: { type: "string" }, avatar: { type: "string" },
                  primaryGoal: { type: "string" }, primaryComplaint: { type: "string" },
                  secondaryGoals: { type: "array", items: { type: "string" } },
                  secondaryComplaints: { type: "array", items: { type: "string" } },
                  promises: { type: "array", items: { type: "string" } },
                  benefits: { type: "array", items: { type: "string" } },
                  objections: { type: "array", items: { type: "string" } },
                  confusions: { type: "array", items: { type: "string" } },
                  ultimateFear: { type: "string" },
                  falseSolutions: { type: "array", items: { type: "string" } },
                  mistakenBeliefs: { type: "array", items: { type: "string" } },
                  frustrations: { type: "array", items: { type: "string" } },
                  everydayRelatability: { type: "string" },
                  commonEnemy: { type: "string" }, tribe: { type: "string" },
                  deepOccultDesire: { type: "string" },
                  coreWounds: { type: "array", items: { type: "string" } },
                  sevenSinsCurrent: {
                    type: "object",
                    properties: { greed: { type: "string" }, gluttony: { type: "string" }, envy: { type: "string" }, wrath: { type: "string" }, lust: { type: "string" }, sloth: { type: "string" }, pride: { type: "string" } },
                    required: ["greed", "gluttony", "envy", "wrath", "lust", "sloth", "pride"]
                  },
                  sevenSinsFuture: {
                    type: "object",
                    properties: { greed: { type: "string" }, gluttony: { type: "string" }, envy: { type: "string" }, wrath: { type: "string" }, lust: { type: "string" }, sloth: { type: "string" }, pride: { type: "string" } },
                    required: ["greed", "gluttony", "envy", "wrath", "lust", "sloth", "pride"]
                  },
                  shameTriggers: { type: "array", items: { type: "string" } },
                  anxietyDrivers: { type: "array", items: { type: "string" } },
                  hopeAnchors: { type: "array", items: { type: "string" } },
                  decisionTriggers: { type: "array", items: { type: "string" } },
                  verbalTriggers: { type: "array", items: { type: "string" } },
                  identityAnchors: { type: "array", items: { type: "string" } },
                  selfImageGap: { type: "string" },
                },
                required: ["niche", "avatar", "primaryGoal", "primaryComplaint", "objections", "ultimateFear", "coreWounds", "sevenSinsCurrent", "sevenSinsFuture", "deepOccultDesire", "verbalTriggers"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_avatar_profile" } },
      }),
    });

    if (!step2Response.ok) {
      if (step2Response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await step2Response.text();
      console.error("Step 2 error:", step2Response.status, errText);
      throw new Error(`Erro na etapa 2: ${step2Response.status}`);
    }

    const step2Data = await step2Response.json();
    const toolCall = step2Data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("Resposta da IA sem dados estruturados na etapa 2");
    }

    const avatarProfile = JSON.parse(toolCall.function.arguments);
    console.log("Step 2 complete. Avatar profile keys:", Object.keys(avatarProfile).length);

    const { error: upsertError } = await supabase
      .from("audience_profiles")
      .upsert({
        user_id: userId,
        audience_description: audienceDescription,
        avatar_profile: avatarProfile,
        generated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Error saving audience profile:", upsertError);
    }

    return new Response(JSON.stringify({
      audienceDescription,
      avatarProfile,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-audience-profile error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
