import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = user.id;

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: usageData } = await adminClient.from("user_usage").select("is_premium, transcriptions, last_transcription_date").eq("user_id", userId).maybeSingle();
    const isPremium = usageData?.is_premium ?? false;
    const today = new Date().toISOString().split("T")[0];
    const isNewDay = usageData?.last_transcription_date !== today;
    const currentTransCount = isNewDay ? 0 : (usageData?.transcriptions ?? 0);
    if (!isPremium && currentTransCount >= 2) return new Response(JSON.stringify({ error: "Você atingiu o limite de 2 transcrições gratuitas. Assine o plano premium para uso ilimitado." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await Promise.all([
      adminClient.from("user_usage").update({ transcriptions: currentTransCount + 1, last_transcription_date: today }).eq("user_id", userId),
      adminClient.from("usage_logs").insert({ user_id: userId, feature: "transcription" }),
    ]);

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const { filePath, mimeType } = await req.json();
    if (!filePath || !mimeType) return new Response(JSON.stringify({ error: "filePath and mimeType are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = adminClient;
    console.log(`Downloading file from storage: ${filePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage.from("media-uploads").download(filePath);
    if (downloadError || !fileData) { console.error("Download error:", downloadError); throw new Error("Erro ao baixar arquivo do storage"); }

    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) binary += String.fromCharCode(uint8Array[i]);
    const base64Data = btoa(binary);
    console.log(`File downloaded: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);

    supabase.storage.from("media-uploads").remove([filePath]).then(({ error }) => { if (error) console.error("Cleanup error:", error); else console.log("Temp file cleaned up"); });

    const isVideo = mimeType.startsWith("video/");
    const mediaType = isVideo ? "vídeo" : "áudio";
    console.log(`Transcribing ${mediaType} (${mimeType})...`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `Você é um transcritor profissional. Transcreva o ${mediaType} enviado de forma precisa e completa em português brasileiro.\nRegras:\n- Transcreva EXATAMENTE o que é falado\n- Mantenha a linguagem original\n- NÃO adicione comentários ou timestamps\n- Retorne APENAS o texto transcrito` }] },
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: `Transcreva este ${mediaType} completamente. Retorne apenas o texto falado.` },
          ],
        }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errorText = await response.text(); console.error("Gemini native error:", response.status, errorText);
      throw new Error(`Gemini error: ${response.status}`);
    }

    const data = await response.json();
    const transcription = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    if (!transcription) return new Response(JSON.stringify({ error: "Não foi possível transcrever o conteúdo." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    console.log(`Transcription complete: ${transcription.length} chars`);
    return new Response(JSON.stringify({ transcription }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao transcrever" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});