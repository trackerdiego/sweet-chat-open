import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiNative } from "../_shared/gemini.ts";

const FUNCTION_VERSION = "2025-04-22-service-role-fallback";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "x-influlab-function-version",
  "x-influlab-function-version": FUNCTION_VERSION,
};

console.log(`[audience-profile] boot v=${FUNCTION_VERSION}`);

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
      required: ["greed", "gluttony", "envy", "wrath", "lust", "sloth", "pride"],
    },
    sevenSinsFuture: {
      type: "object",
      properties: { greed: { type: "string" }, gluttony: { type: "string" }, envy: { type: "string" }, wrath: { type: "string" }, lust: { type: "string" }, sloth: { type: "string" }, pride: { type: "string" } },
      required: ["greed", "gluttony", "envy", "wrath", "lust", "sloth", "pride"],
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

// ─── Fallback local quando Gemini falha/demora ────────────────────
function buildFallbackDescription(primaryNiche: string, secondaryList: string, styleDesc: string): string {
  return `Público-alvo de criadores(as) brasileiros(as) interessados(as) em ${primaryNiche}${secondaryList ? `, com afinidade por ${secondaryList}` : ""}. São pessoas entre 22 e 40 anos, conectadas, que consomem conteúdo curto e direto nas redes sociais (Instagram, TikTok, YouTube). Buscam transformação real e prática, valorizam autenticidade e se identificam com criadores(as) que falam de forma ${styleDesc}. Sentem frustração com promessas vazias do mercado digital, têm medo de investir tempo/dinheiro e não ver resultado, e desejam profundamente uma virada de chave que dê sentido ao seu trabalho diário. Preferem aprender com quem demonstra resultado e mostra o caminho passo a passo, sem enrolação. Comportamento: salvam posts úteis, comentam quando se identificam, seguem por consistência, abandonam quando o conteúdo vira só venda.`;
}

function buildFallbackAvatar(primaryNiche: string, secondaryList: string, styleDesc: string, audienceDescription: string): Record<string, unknown> {
  return {
    niche: primaryNiche,
    avatar: `Pessoa entre 25 e 38 anos, brasileira, conectada, em busca de domínio em ${primaryNiche}. Já tentou de tudo, está cansada de receitas prontas e quer um caminho próprio.`,
    primaryGoal: `Conquistar autoridade e resultado consistente em ${primaryNiche}, sentindo orgulho do próprio trabalho.`,
    primaryComplaint: "Faço tudo que dizem pra fazer e mesmo assim não vejo resultado proporcional ao esforço.",
    secondaryGoals: ["Construir uma audiência real e fiel", "Ter renda previsível com o que ama", "Ser reconhecido(a) como referência no nicho"],
    secondaryComplaints: ["Algoritmo imprevisível", "Falta de tempo para criar com qualidade", "Sensação de gritar no vácuo"],
    promises: ["Clareza sobre o que postar", "Direção estratégica concreta", "Resultados mensuráveis"],
    benefits: ["Mais engajamento real", "Posicionamento claro", "Confiança na própria voz"],
    objections: ["Já tentei várias estratégias e nenhuma funcionou", "Não tenho tempo pra mais um método", "Vai ser igual aos outros"],
    confusions: ["Não sei se devo focar em volume ou qualidade", "Não entendo o que o algoritmo realmente quer", "Não sei medir o que está funcionando"],
    ultimateFear: "Continuar invisível, trabalhando muito e sem nunca ser reconhecido(a) — desperdiçar a chance da minha vida.",
    falseSolutions: ["Postar mais vezes por dia", "Copiar trends sem contexto", "Comprar seguidores ou engajamento"],
    mistakenBeliefs: ["Quem ganha é quem posta mais", "É tudo questão de sorte com o algoritmo", "Preciso aparecer perfeito(a) pra dar certo"],
    frustrations: ["Vídeo viralizar uma vez e nunca mais", "Não saber o que postar amanhã", "Comparar-se com criadores(as) maiores"],
    everydayRelatability: `Acorda olhando notificações, sente uma pontada quando o post não bombou, abre o app dos concorrentes e se compara, faz café e tenta reescrever o roteiro pela quinta vez.`,
    commonEnemy: "Os gurus que vendem fórmulas mágicas e o algoritmo que muda as regras toda semana.",
    tribe: `Comunidade brasileira de criadores(as) sérios(as) em ${primaryNiche}${secondaryList ? ` e ${secondaryList}` : ""}, que querem crescer com estratégia e não com sorte.`,
    deepOccultDesire: "Ser visto(a) como referência incontestável — ter pessoas dizendo 'foi você que mudou minha forma de ver isso'.",
    coreWounds: ["Sentir que o esforço não é reconhecido", "Medo de não ser bom(a) o suficiente", "Vergonha de tentar e falhar publicamente"],
    sevenSinsCurrent: {
      greed: "Quer mais alcance, mais seguidores, mais views — sempre.",
      gluttony: "Consome cursos, mentorias, ebooks sem aplicar.",
      envy: "Olha para criadores(as) maiores e sente que poderia ser ele(a).",
      wrath: "Raiva de algoritmos, de comentários tóxicos, de plágios.",
      lust: "Deseja a vida do criador(a) de sucesso — viagens, liberdade, status.",
      sloth: "Procrastina o que é difícil (estratégia) e foca no fácil (postar qualquer coisa).",
      pride: "Acha que já sabe o suficiente — resiste a mudar de método.",
    },
    sevenSinsFuture: {
      greed: "Quer dominar o nicho e ser top 1.",
      gluttony: "Devorar todo conhecimento estratégico de verdade.",
      envy: "Ser invejado(a) pelos pares.",
      wrath: "Provar pra quem duvidou que era possível.",
      lust: "Viver da própria criação com liberdade total.",
      sloth: "Construir um sistema que rode com menos esforço diário.",
      pride: "Sentir orgulho legítimo do que construiu.",
    },
    shameTriggers: ["Vídeo com poucas views", "Comentário negativo público", "Família perguntando 'isso dá dinheiro?'"],
    anxietyDrivers: ["Mudanças do algoritmo", "Falta de ideia para o próximo post", "Comparação com concorrentes"],
    hopeAnchors: ["Um comentário sincero de alguém impactado(a)", "Crescimento mesmo que pequeno", "Convite ou reconhecimento de pares"],
    decisionTriggers: ["Ver resultado real de alguém parecido(a)", "Sentir que o método é claro e aplicável", "Promessa de economizar tempo"],
    verbalTriggers: ["Estratégia", "Autoridade", "Posicionamento", "Sem enrolação", "Resultado real"],
    identityAnchors: [`Sou criador(a) de conteúdo em ${primaryNiche}`, "Sou alguém que constrói algo próprio", "Sou referência em formação"],
    selfImageGap: "Vê-se como alguém com potencial enorme, mas sente que ainda não foi reconhecido(a) — gap entre o que é por dentro e o que mostra por fora.",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");

    // Cliente anon SÓ pra validar JWT
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    // Cliente admin (service role) pra writes — bypassa RLS no self-hosted
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

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

    const stepName = step === "avatar" ? "avatar" : "description";

    // ─────────────────────────────────────────────────────────────
    // STEP 1: descrição do público
    // ─────────────────────────────────────────────────────────────
    if (stepName === "description") {
      if (!primaryNiche) {
        return new Response(JSON.stringify({ error: "primaryNiche é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log("[audience-profile] Step 1: description");
      let audienceDescription = "";
      let source: "ai" | "fallback" = "ai";

      try {
        const step1 = await callGeminiNative({
          apiKey: GOOGLE_GEMINI_API_KEY,
          systemInstruction: `Você é uma estrategista de público digital especialista em criadores(as) de conteúdo brasileiros(as). Crie uma descrição rica e detalhada do público-alvo ideal. Use linguagem neutra de gênero — NUNCA use termos exclusivamente femininos ou masculinos. Use formas neutras ou com barra (criador/a, autêntico/a).`,
          prompt: `Crie uma descrição detalhada do público-alvo ideal para um(a) criador(a) de conteúdo brasileiro(a) com base nesta descrição:\n\n${primaryNiche}\n\n${secondaryList ? `Interesses complementares: ${secondaryList}` : ""}\nEstilo de comunicação: ${styleDesc}\n\nA descrição deve incluir:\n- Quem são essas pessoas (demografia, psicografia)\n- O que consomem de conteúdo\n- Quais suas principais dores e frustrações\n- Quais seus desejos e aspirações\n- Como se comportam nas redes sociais\n- O que as motiva a seguir criadores(as) de conteúdo\n- Qual transformação buscam\n\nSeja específico(a), visceral e profundo(a). Nada genérico.`,
          model: "gemini-2.5-flash",
          fallbackModel: "gemini-2.5-flash-lite",
          tag: "audience-step1",
          maxOutputTokens: 3000,
          timeoutMs: 12000,
          fallbackTimeoutMs: 12000,
          primaryAttempts: 1,
          fallbackAttempts: 1,
        });
        audienceDescription = (step1.text || "").trim();
        if (!audienceDescription || audienceDescription.length < 80) {
          throw new Error("descrição muito curta ou vazia");
        }
        console.log(`[audience-profile] Step 1 ai ok — ${audienceDescription.length} chars, model=${step1.modelUsed}`);
      } catch (e) {
        source = "fallback";
        audienceDescription = buildFallbackDescription(primaryNiche, secondaryList, styleDesc);
        console.warn(`[audience-profile] Step 1 fallback — ${e instanceof Error ? e.message : String(e)}`);
      }

      const { error: upsertError } = await adminClient
        .from("audience_profiles")
        .upsert({
          user_id: userId,
          audience_description: audienceDescription,
          generated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("[audience-profile] upsert description failed:", upsertError);
        return new Response(JSON.stringify({ error: "Falha ao salvar descrição", retryable: true, detail: upsertError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Marca description_status na user_profiles
      await adminClient.from("user_profiles").update({ description_status: "ready" }).eq("user_id", userId);

      return new Response(JSON.stringify({ step: "description", audienceDescription, source }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 2: avatar visceral
    // ─────────────────────────────────────────────────────────────
    console.log("[audience-profile] Step 2: avatar");

    const { data: existing } = await adminClient
      .from("audience_profiles")
      .select("audience_description")
      .eq("user_id", userId)
      .maybeSingle();

    let audienceDescription = existing?.audience_description || "";
    if (!audienceDescription) {
      // Em vez de 400, gera fallback de descrição na hora pra não travar
      audienceDescription = buildFallbackDescription(primaryNiche || "criação de conteúdo", secondaryList, styleDesc);
      await adminClient.from("audience_profiles").upsert({
        user_id: userId,
        audience_description: audienceDescription,
        generated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    const niche = primaryNiche || "";
    let avatarProfile: Record<string, unknown> = {};
    let source: "ai" | "fallback" = "ai";

    try {
      const step2 = await callGeminiNative({
        apiKey: GOOGLE_GEMINI_API_KEY,
        systemInstruction: `Act as a Master Copywriter and Direct Response Strategist, specializing in deep psychology and consumer behavior. Your language must be visceral, real, and dimensional. You do not tolerate vague or superficial answers.\n\nYour mission is to build the most robust and compelling Avatar Profile possible. You must analyze and fill in ALL of the following fields in ONE SINGLE RESPONSE.\n\nCRITICAL: All output must be in Native Brazilian Portuguese. Use linguagem neutra de gênero.`,
        prompt: `[Product/Audience]= Criador(a) de conteúdo digital brasileiro(a). Descrição do negócio/conteúdo:\n"${niche}"\n${secondaryList ? `Interesses complementares: ${secondaryList}` : ""}\nEstilo: ${styleDesc}.\n\nDescrição detalhada do público:\n${audienceDescription}\n\nPreencha o perfil completo do avatar no formato JSON do schema. Visceral, profundo(a), específico(a). NADA genérico. Preencha TODOS os campos.`,
        schema: AVATAR_SCHEMA,
        model: "gemini-2.5-flash",
        fallbackModel: "gemini-2.5-flash-lite",
        tag: "audience-step2",
        maxOutputTokens: 8192,
        timeoutMs: 18000,
        fallbackTimeoutMs: 16000,
        primaryAttempts: 1,
        fallbackAttempts: 1,
      });
      const parsed = step2.json as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || !parsed.avatar) {
        throw new Error("avatar inválido");
      }
      avatarProfile = parsed;
      console.log(`[audience-profile] Step 2 ai ok — ${Object.keys(avatarProfile).length} campos, model=${step2.modelUsed}`);
    } catch (e) {
      source = "fallback";
      avatarProfile = buildFallbackAvatar(niche || "criação de conteúdo", secondaryList, styleDesc, audienceDescription);
      console.warn(`[audience-profile] Step 2 fallback — ${e instanceof Error ? e.message : String(e)}`);
    }

    const { error: upsertError } = await adminClient
      .from("audience_profiles")
      .upsert({
        user_id: userId,
        audience_description: audienceDescription,
        avatar_profile: avatarProfile,
        generated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("[audience-profile] upsert avatar failed:", upsertError);
      return new Response(JSON.stringify({ error: "Falha ao salvar avatar", retryable: true, detail: upsertError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ step: "avatar", audienceDescription, avatarProfile, source }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-audience-profile error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido", retryable: true }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
