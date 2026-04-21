import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiNative, GeminiError } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

console.log("[audience-profile] boot — split steps (description|avatar), gateway-safe timeout");

const AVATAR_SCHEMA = {
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
  required: ["niche", "avatar", "primaryGoal", "primaryComplaint", "ultimateFear", "deepOccultDesire"],
};

function geminiErrorResponse(e: GeminiError) {
  const status = e.status === 429 ? 429 : 503;
  const msg = e.status === 429
    ? "Limite de requisições excedido. Tente novamente."
    : "Serviço de IA instável. Tente novamente em 1-2 minutos.";
  return new Response(
    JSON.stringify({ error: msg, retryable: true }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const { primaryNiche, secondaryNiches, contentStyle, step } = body as {
      primaryNiche?: string; secondaryNiches?: string[]; contentStyle?: string; step?: string;
    };

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const secondaryList = (secondaryNiches || []).join(", ");
    const styleMap: Record<string, string> = {
      casual: "leve, descontraído, como conversa entre amigos",
      profissional: "autoritário, informativo, com dados e dicas práticas",
      divertido: "engraçado, irreverente, usando memes e trends",
    };
    const styleDesc = styleMap[contentStyle || "casual"] || styleMap.casual;

    // Default = 'description' para compat com chamadas antigas (frontend novo manda explícito).
    const stepName = step === "avatar" ? "avatar" : "description";

    // ─────────────────────────────────────────────────────────────
    // STEP 1: descrição do público (texto livre)
    // ─────────────────────────────────────────────────────────────
    if (stepName === "description") {
      if (!primaryNiche) {
        return new Response(JSON.stringify({ error: "primaryNiche é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log("[audience-profile] Step 1: audience description");
      let step1;
      try {
        step1 = await callGeminiNative({
          apiKey: GOOGLE_GEMINI_API_KEY,
          systemInstruction: `Você é uma estrategista de público digital especialista em criadores(as) de conteúdo brasileiros(as). Crie uma descrição rica e detalhada do público-alvo ideal. Use linguagem neutra de gênero — NUNCA use termos exclusivamente femininos ou masculinos. Use formas neutras ou com barra (criador/a, autêntico/a).`,
          prompt: `Crie uma descrição detalhada do público-alvo ideal para um(a) criador(a) de conteúdo brasileiro(a) com base nesta descrição:\n\n${primaryNiche}\n\n${secondaryList ? `Interesses complementares: ${secondaryList}` : ''}\nEstilo de comunicação: ${styleDesc}\n\nA descrição deve incluir:\n- Quem são essas pessoas (demografia, psicografia)\n- O que consomem de conteúdo\n- Quais suas principais dores e frustrações\n- Quais seus desejos e aspirações\n- Como se comportam nas redes sociais\n- O que as motiva a seguir criadores(as) de conteúdo\n- Qual transformação buscam\n\nSeja específico(a), visceral e profundo(a). Nada genérico.`,
          model: "gemini-2.5-flash",
          fallbackModel: "gemini-2.5-flash-lite",
          tag: "audience-step1",
          maxOutputTokens: 4000,
          timeoutMs: 35000,
          fallbackTimeoutMs: 30000,
          primaryAttempts: 1,
          fallbackAttempts: 2,
        });
      } catch (e) {
        if (e instanceof GeminiError) return geminiErrorResponse(e);
        throw e;
      }

      const audienceDescription = step1.text || "";
      if (!audienceDescription) throw new Error("Etapa 1 não retornou descrição");
      console.log(`[audience-profile] Step 1 ok — ${audienceDescription.length} chars, model=${step1.modelUsed}`);

      const { error: upsertError } = await supabase
        .from("audience_profiles")
        .upsert({
          user_id: userId,
          audience_description: audienceDescription,
          generated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) console.error("Error saving audience description:", upsertError);

      return new Response(JSON.stringify({ step: "description", audienceDescription }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 2: avatar visceral (responseSchema)
    // ─────────────────────────────────────────────────────────────
    console.log("[audience-profile] Step 2: visceral avatar");

    // Lê descrição já salva
    const { data: existing } = await supabase
      .from("audience_profiles")
      .select("audience_description")
      .eq("user_id", userId)
      .maybeSingle();

    const audienceDescription = existing?.audience_description || "";
    if (!audienceDescription) {
      return new Response(JSON.stringify({ error: "Descrição de público não encontrada. Rode step='description' primeiro.", retryable: true }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const niche = primaryNiche || "";

    const avatarSystem = `Act as a Master Copywriter and Direct Response Strategist, specializing in deep psychology and consumer behavior. Your language must be visceral, real, and dimensional. You do not tolerate vague or superficial answers.\n\nYour mission is to build the most robust and compelling Avatar Profile possible, based on the product/audience information below. You must analyze and fill in ALL of the following fields in ONE SINGLE RESPONSE.\n\nUse your vast knowledge base to infer realistic details, going beyond the obvious. I do not want generic answers. I want the psychological truth behind this avatar.\n\nCRITICAL INSTRUCTION: All of your answers and all output must be in Native Brazilian Portuguese (Português Nativo do Brasil). Use linguagem neutra de gênero — NUNCA use termos exclusivamente femininos ou masculinos. Use formas neutras ou com barra (criador/a, autêntico/a, inspirado/a).`;

    const avatarPrompt = `[Product/Audience]= Criador(a) de conteúdo digital brasileiro(a). Descrição do negócio/conteúdo:\n"${niche}"\n${secondaryList ? `Interesses complementares: ${secondaryList}` : ''}\nEstilo de comunicação: ${styleDesc}.\n\nDescrição detalhada do público-alvo:\n${audienceDescription}\n\nCom base nessas informações, preencha o perfil completo do avatar no formato JSON definido pelo schema. Seja visceral, profundo(a) e específico(a). NADA genérico. Preencha TODOS os campos.`;

    let step2;
    try {
      step2 = await callGeminiNative({
        apiKey: GOOGLE_GEMINI_API_KEY,
        systemInstruction: avatarSystem,
        prompt: avatarPrompt,
        schema: AVATAR_SCHEMA,
        model: "gemini-2.5-flash",
        fallbackModel: "gemini-2.5-flash-lite",
        tag: "audience-step2",
        maxOutputTokens: 8192,
        timeoutMs: 35000,
        fallbackTimeoutMs: 30000,
        primaryAttempts: 1,
        fallbackAttempts: 2,
      });
    } catch (e) {
      if (e instanceof GeminiError) return geminiErrorResponse(e);
      throw e;
    }

    const avatarProfile = step2.json as Record<string, unknown>;
    if (!avatarProfile || typeof avatarProfile !== "object") {
      throw new Error("Etapa 2 retornou avatar inválido");
    }
    console.log(`[audience-profile] Step 2 ok — ${Object.keys(avatarProfile).length} campos, model=${step2.modelUsed}`);

    const { error: upsertError } = await supabase
      .from("audience_profiles")
      .upsert({
        user_id: userId,
        audience_description: audienceDescription,
        avatar_profile: avatarProfile,
        generated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) console.error("Error saving avatar profile:", upsertError);

    return new Response(JSON.stringify({ step: "avatar", audienceDescription, avatarProfile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-audience-profile error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido", retryable: true }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
