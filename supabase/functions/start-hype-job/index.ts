// start-hype-job
// Cria job assíncrono que devolve "Hype do Dia" personalizado pro nicho do user.
// Cache 24h em user_daily_hype (UNIQUE user_id+date). Se já tem hoje, devolve
// direto sem chamar Gemini. Se daily_hype_raw de hoje não existe, coleta na hora.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiNative, GeminiError } from "../_shared/gemini.ts";
import { corsHeaders, jsonResponse, enqueueJob, runInBackground, JobError } from "../_shared/ai-job-runner.ts";
import {
  fetchGoogleTrendsBR,
  fetchGoogleTrendsRealtimeBR,
  fetchReddit,
  fetchYouTubeTrendingBR,
  fetchYouTubeShortsBR,
  fetchYouTubeMusicTrendingBR,
  type RawTrend,
} from "../_shared/hype-sources.ts";

const FUNCTION_VERSION = "2026-05-21-hype-v2-multisource";
console.log(`[start-hype-job] boot v=${FUNCTION_VERSION}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const result = await enqueueJob({ req, jobType: "hype" as any, payload: {} });
    if (result instanceof Response) return result;
    const { jobId, userId, userClient, admin } = result;

    runInBackground(admin, jobId, async () => {
      const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
      if (!GOOGLE_GEMINI_API_KEY) throw new JobError("Chave da IA ausente.");

      const today = new Date().toISOString().split("T")[0];

      // 1) Cache hit? Devolve já
      const { data: cached } = await admin
        .from("user_daily_hype")
        .select("items")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();
      if (cached?.items && Array.isArray(cached.items) && cached.items.length > 0) {
        return { items: cached.items, cached: true };
      }

      // 2) Busca trends crus do dia, senão coleta agora (self-bootstrap)
      const { data: rawRows } = await admin
        .from("daily_hype_raw")
        .select("source, trends")
        .eq("date", today);

      let allTrends: RawTrend[] = [];
      if (rawRows && rawRows.length > 0) {
        for (const r of rawRows) {
          if (Array.isArray(r.trends)) allTrends.push(...(r.trends as RawTrend[]));
        }
      } else {
        console.log(`[start-hype-job] no raw data for ${today}, fetching live (6 sources)`);
        const youtubeKey = Deno.env.get("YOUTUBE_API_KEY") ?? "";
        const [gtRss, gtRealtime, rd, ytTrending, ytShorts, ytMusic] = await Promise.all([
          fetchGoogleTrendsBR(),
          fetchGoogleTrendsRealtimeBR(),
          fetchReddit(),
          fetchYouTubeTrendingBR(youtubeKey),
          fetchYouTubeShortsBR(youtubeKey),
          fetchYouTubeMusicTrendingBR(youtubeKey),
        ]);
        const googleAll = [...gtRss, ...gtRealtime];
        const youtubeAll = [...ytTrending, ...ytShorts, ...ytMusic];
        allTrends = [...googleAll, ...rd, ...youtubeAll];
        console.log(`[start-hype-job] live counts`, {
          gtRss: gtRss.length, gtRealtime: gtRealtime.length, reddit: rd.length,
          ytTrending: ytTrending.length, ytShorts: ytShorts.length, ytMusic: ytMusic.length,
        });
        const rows = [
          { date: today, source: "google_trends", trends: googleAll },
          { date: today, source: "reddit", trends: rd },
          { date: today, source: "youtube", trends: youtubeAll },
        ].filter((r) => r.trends.length > 0);
        if (rows.length > 0) {
          await admin.from("daily_hype_raw").upsert(rows, { onConflict: "date,source" });
        }
      }

      const degraded = allTrends.length === 0;
      if (degraded) {
        console.warn(`[start-hype-job] ZERO trends — caindo pra evergreen via Gemini`);
      }

      // 3) Perfil do user pra personalizar
      const [{ data: profile }, { data: audience }] = await Promise.all([
        userClient.from("user_profiles").select("primary_niche, content_style, audience_size, display_name").eq("user_id", userId).maybeSingle(),
        userClient.from("audience_profiles").select("avatar_profile").eq("user_id", userId).maybeSingle(),
      ]);

      const niche = profile?.primary_niche || "lifestyle";
      const style = profile?.content_style || "casual";
      const ap = (audience?.avatar_profile as Record<string, unknown> | null) ?? {};

      // Compacta trends (top 60). Em modo degraded, vai vazio e prompt vira evergreen.
      const compact = allTrends
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 60)
        .map((t) => `[${t.source}${t.subsource ? "/" + t.subsource : ""}${t.category ? "|" + t.category : ""}] ${t.title}${t.context ? " — " + t.context : ""}`)
        .join("\n");

      // 3) Perfil do user pra personalizar
      const [{ data: profile }, { data: audience }] = await Promise.all([
        userClient.from("user_profiles").select("primary_niche, content_style, audience_size, display_name").eq("user_id", userId).maybeSingle(),
        userClient.from("audience_profiles").select("avatar_profile").eq("user_id", userId).maybeSingle(),
      ]);

      const niche = profile?.primary_niche || "lifestyle";
      const style = profile?.content_style || "casual";
      const ap = (audience?.avatar_profile as Record<string, unknown> | null) ?? {};

      const systemInstruction = `Você é um curador de tendências brasileiro especialista em criação de conteúdo para o nicho "${niche}". Estilo do criador: ${style}.

PERFIL DO PÚBLICO:
Avatar: ${ap.avatar || "não definido"}
Desejo oculto: ${ap.deepOccultDesire || ""}
Dores: ${JSON.stringify(ap.coreWounds || [])}
Gatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}

REGRAS:
- Escreva em português brasileiro padrão (norma culta), ortografia impecável.
- PROIBIDO: "todes", "amigues", "x"/"e"/"@" trocando gênero, abreviações ("vc", "pq", "tb").
- Selecione apenas tendências que CONVERSAM com o nicho "${niche}" e o público acima.
- Descarte tendências políticas pesadas, tragédias, esporte (a menos que o nicho seja exatamente isso).
- Cada item deve ter um gancho PRONTO pra gravar (não genérico).`;

      const prompt = degraded
        ? `As fontes de tendências em tempo real estão indisponíveis agora (${today}).

Gere 5 PAUTAS EVERGREEN de altíssima conversão pro nicho "${niche}", aproveitando o perfil do público descrito acima. Devem parecer atuais e relevantes, baseadas em padrões de conteúdo que SEMPRE funcionam nesse nicho (curiosidade, transformação, mito x verdade, bastidor, antes/depois, lista). Para cada uma:
- tema: o nome curto da pauta
- porque_bombou: 1 frase explicando por que esse ângulo sempre engaja nesse nicho
- gancho: frase de abertura pronta pra falar na câmera (1ª pessoa, máx 180 caracteres, faz o público parar de scrollar)
- formato_sugerido: "Reels", "Story", "Carrossel" ou "TikTok"
- angulo: como conectar a pauta ao nicho "${niche}" em 1 frase
- fonte: use "evergreen"`
        : `TENDÊNCIAS BRASILEIRAS DE HOJE (${today}):

${compact}

Escolha as 5 MAIS RELEVANTES pro nicho "${niche}" e devolva no formato JSON pedido. Para cada uma:
- tema: o nome curto da tendência
- porque_bombou: 1 frase explicando o motivo do hype hoje
- gancho: frase de abertura pronta pra falar na câmera (1ª pessoa, máx 180 caracteres, faz o público parar de scrollar)
- formato_sugerido: "Reels", "Story", "Carrossel" ou "TikTok"
- angulo: como conectar essa tendência ao nicho "${niche}" em 1 frase
- fonte: a fonte original ("google_trends", "reddit" ou "youtube")`;

      const schema = {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tema: { type: "string" },
                porque_bombou: { type: "string" },
                gancho: { type: "string" },
                formato_sugerido: { type: "string" },
                angulo: { type: "string" },
                fonte: { type: "string" },
              },
              required: ["tema", "porque_bombou", "gancho", "formato_sugerido", "angulo", "fonte"],
            },
          },
        },
        required: ["items"],
      };

      let res: Awaited<ReturnType<typeof callGeminiNative>>;
      try {
        res = await callGeminiNative({
          apiKey: GOOGLE_GEMINI_API_KEY,
          systemInstruction,
          prompt,
          schema,
          tag: "hype",
          model: "gemini-2.5-flash",
          midModel: "gemini-2.5-flash-lite",
          fallbackModel: "gemini-2.5-pro",
          maxOutputTokens: 2200,
          timeoutMs: 45000,
          midTimeoutMs: 35000,
          fallbackTimeoutMs: 60000,
          primaryAttempts: 2,
          midAttempts: 2,
          fallbackAttempts: 1,
        });
      } catch (e) {
        if (e instanceof GeminiError) {
          if (e.status === 429) throw new JobError("Muitas requisições. Aguarde alguns segundos.");
          if (e.status === 402) throw new JobError("Créditos da IA esgotados. Avise o administrador.");
          throw new JobError("Serviço de IA instável. Tente novamente em 1-2 minutos.", e);
        }
        throw new JobError("Erro ao gerar hype do dia.");
      }

      const payload = res.json as { items: unknown[] };
      const items = Array.isArray(payload.items) ? payload.items.slice(0, 5) : [];

      // Persiste no cache do user
      await admin
        .from("user_daily_hype")
        .upsert({ user_id: userId, date: today, items }, { onConflict: "user_id,date" });

      console.log(`[start-hype-job] job ${jobId} success`, { count: items.length, attempts: res.attempts, modelUsed: res.modelUsed });
      return { items, cached: false, __meta: { attempts: res.attempts, modelUsed: res.modelUsed } };
    });

    return jsonResponse({ jobId });
  } catch (e) {
    console.error("[start-hype-job] uncaught error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
