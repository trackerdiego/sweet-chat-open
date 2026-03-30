import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-runtime",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { userId, niche, description } = await req.json();

    const prompt = `
      Analise o seguinte nicho de mercado: "${niche}" com a descrição: "${description}".
      Crie um perfil de audiência visceral contendo:
      1. Dores profundas (o que tira o sono deles).
      2. Desejos ocultos (o que eles realmente buscam).
      3. Gatilhos emocionais (o que os faz clicar ou comprar).
      4. Linguagem e tom de voz ideal para se conectar com eles.
      
      Retorne em formato JSON:
      {
        "pain_points": ["dor1", "dor2"],
        "desires": ["desejo1", "desejo2"],
        "emotional_triggers": ["gatilho1", "gatilho2"],
        "tone_of_voice": "descrição do tom"
      }
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();
    const audienceProfile = JSON.parse(data.choices[0].message.content);

    const { error } = await supabaseClient
      .from("audience_profiles")
      .upsert({
        user_id: userId,
        profile_data: audienceProfile,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return new Response(JSON.stringify(audienceProfile), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
