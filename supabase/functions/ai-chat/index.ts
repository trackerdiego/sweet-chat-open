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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: usage } = await adminClient
      .from("user_usage")
      .select("is_premium, chat_messages, last_chat_date")
      .eq("user_id", userId)
      .maybeSingle();

    const isPremium = usage?.is_premium ?? false;
    const today = new Date().toISOString().split("T")[0];
    const isNewDay = usage?.last_chat_date !== today;
    const chatCount = isNewDay ? 0 : (usage?.chat_messages ?? 0);

    if (!isPremium && chatCount >= 10) {
      return new Response(
        JSON.stringify({ error: "Você utilizou suas 10 mensagens gratuitas do Consultor IA. Assine o plano premium para continuar usando." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [audienceRes, profileRes] = await Promise.all([
      adminClient.from("audience_profiles").select("avatar_profile, audience_description").eq("user_id", userId).maybeSingle(),
      adminClient.from("user_profiles").select("primary_niche, content_style, display_name").eq("user_id", userId).maybeSingle(),
    ]);

    const avatar = audienceRes.data?.avatar_profile;
    const audienceDesc = audienceRes.data?.audience_description;
    const profile = profileRes.data;

    let systemPrompt = `Você é um consultor estratégico de conteúdo digital especializado. Responda SEMPRE em Português Brasileiro, com linguagem neutra de gênero. NUNCA use termos exclusivamente femininos ou masculinos. Use sempre formas neutras ou com barra (criador/a, autêntico/a, preparado/a). Trate o usuário como "criador(a) de conteúdo".

Você conhece profundamente o público e o nicho desta pessoa criadora de conteúdo. Use esse conhecimento para dar conselhos específicos, estratégicos e acionáveis — nunca genéricos.

Seja direto, prático e perspicaz. Quando sugerir algo, explique o "porquê" emocional/psicológico por trás.`;

    if (profile) {
      systemPrompt += `\n\n## Perfil do Criador\n- Nome: ${profile.display_name}\n- Nicho principal: ${profile.primary_niche}\n- Estilo de conteúdo: ${profile.content_style}`;
    }

    if (audienceDesc) {
      systemPrompt += `\n\n## Descrição do Público\n${audienceDesc}`;
    }

    if (avatar && typeof avatar === "object") {
      systemPrompt += `\n\n## Estudo Visceral do Avatar (Perfil Psicológico do Público)\n${JSON.stringify(avatar, null, 2)}`;
    }

    systemPrompt += `\n\nUse TODO esse contexto em cada resposta. Não peça mais informações sobre o público — você já sabe tudo. Seja o consultor que entrega ouro em cada frase.`;

    await Promise.all([
      adminClient.from("user_usage").update({ chat_messages: chatCount + 1 }).eq("user_id", userId),
      adminClient.from("usage_logs").insert({ user_id: userId, feature: "chat" }),
    ]);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
