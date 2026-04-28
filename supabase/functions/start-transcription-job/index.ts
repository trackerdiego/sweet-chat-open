// start-transcription-job
// Cria job assíncrono pra transcrição de áudio (após upload já feito pro Storage).
// Vídeo é convertido em áudio no frontend (FFMPEG) antes do upload.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse, enqueueJob, runInBackground, JobError } from "../_shared/ai-job-runner.ts";

const FUNCTION_VERSION = "2026-04-28-async-transcription";
console.log(`[start-transcription-job] boot v=${FUNCTION_VERSION}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json() as Record<string, unknown>;
    const filePath = payload.filePath as string;
    const mimeType = payload.mimeType as string;
    if (!filePath || !mimeType) {
      return jsonResponse({ error: "filePath e mimeType são obrigatórios" }, 400);
    }

    const result = await enqueueJob({ req, jobType: "transcription", payload });
    if (result instanceof Response) return result;
    const { jobId, userId, admin } = result;

    runInBackground(admin, jobId, async () => {
      const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
      if (!GOOGLE_GEMINI_API_KEY) throw new JobError("Configuração do servidor incompleta (chave da IA ausente).");

      // Quota check
      const { data: usageData } = await admin.from("user_usage")
        .select("is_premium, transcriptions, last_transcription_date")
        .eq("user_id", userId).maybeSingle();
      const u = usageData as { is_premium?: boolean; transcriptions?: number; last_transcription_date?: string } | null;
      const isPremium = u?.is_premium ?? false;
      const today = new Date().toISOString().split("T")[0];
      const isNewDay = u?.last_transcription_date !== today;
      const currentCount = isNewDay ? 0 : (u?.transcriptions ?? 0);
      if (!isPremium && currentCount >= 2) {
        throw new JobError("Você atingiu o limite de 2 transcrições gratuitas. Assine o plano premium para uso ilimitado.");
      }

      // Download arquivo do storage
      console.log(`[start-transcription-job] job ${jobId} downloading ${filePath}`);
      const { data: fileData, error: downloadError } = await admin.storage.from("media-uploads").download(filePath);
      if (downloadError || !fileData) {
        console.error(`[start-transcription-job] download failed for job ${jobId}`, downloadError);
        throw new JobError("Erro ao baixar arquivo do storage. Tente reenviar.");
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8Array.length; i++) binary += String.fromCharCode(uint8Array[i]);
      const base64Data = btoa(binary);
      console.log(`[start-transcription-job] job ${jobId} file ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);

      // Cleanup do storage (não bloqueia)
      admin.storage.from("media-uploads").remove([filePath]).then(({ error }) => {
        if (error) console.error(`[start-transcription-job] cleanup error job ${jobId}`, error);
      });

      const isVideo = mimeType.startsWith("video/");
      const mediaType = isVideo ? "vídeo" : "áudio";

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
        if (response.status === 429) throw new JobError("Limite de requisições atingido na IA. Tente em 1-2 minutos.");
        if (response.status === 402) throw new JobError("Créditos da IA esgotados.");
        const errorText = await response.text();
        console.error(`[start-transcription-job] gemini error job ${jobId}`, response.status, errorText);
        throw new JobError(`Falha na transcrição (Gemini ${response.status}). Tente novamente.`);
      }

      const data = await response.json();
      const transcription = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
      if (!transcription) throw new JobError("Não foi possível transcrever o conteúdo.");

      // Contabiliza uso
      try {
        await Promise.all([
          admin.from("user_usage").update({ transcriptions: currentCount + 1, last_transcription_date: today }).eq("user_id", userId),
          admin.from("usage_logs").insert({ user_id: userId, feature: "transcription" }),
        ]);
      } catch (e) {
        console.warn(`[start-transcription-job] usage update failed job ${jobId}`, e);
      }

      console.log(`[start-transcription-job] job ${jobId} success ${transcription.length} chars`);
      return { transcription };
    });

    return jsonResponse({ jobId });
  } catch (e) {
    console.error("[start-transcription-job] uncaught error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
