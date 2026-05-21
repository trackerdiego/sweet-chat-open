// fetch-daily-hype — cron diário (06h BRT / 09h UTC).
// Coleta trends de Google Trends (RSS + Realtime) + Reddit (best-effort) +
// YouTube Trending + YouTube Shorts + YouTube Music e grava em daily_hype_raw.
//
// Proteção: header `x-cron-secret` deve bater com env CRON_SECRET, senão 401.
// Pode ser chamada manualmente pra forçar refresh.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchGoogleTrendsBR,
  fetchGoogleTrendsRealtimeBR,
  fetchReddit,
  fetchYouTubeTrendingBR,
  fetchYouTubeShortsBR,
  fetchYouTubeMusicTrendingBR,
} from "../_shared/hype-sources.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const today = new Date().toISOString().split("T")[0];
  const youtubeKey = Deno.env.get("YOUTUBE_API_KEY") ?? "";

  const [gtRss, gtRealtime, reddit, ytTrending, ytShorts, ytMusic] = await Promise.all([
    fetchGoogleTrendsBR(),
    fetchGoogleTrendsRealtimeBR(),
    fetchReddit(),
    fetchYouTubeTrendingBR(youtubeKey),
    fetchYouTubeShortsBR(youtubeKey),
    fetchYouTubeMusicTrendingBR(youtubeKey),
  ]);

  // Agrupa por source bucket (a tabela tem UNIQUE date+source)
  const googleAll = [...gtRss, ...gtRealtime];
  const youtubeAll = [...ytTrending, ...ytShorts, ...ytMusic];

  const rows = [
    { date: today, source: "google_trends", trends: googleAll },
    { date: today, source: "reddit", trends: reddit },
    { date: today, source: "youtube", trends: youtubeAll },
  ].filter((r) => r.trends.length > 0);

  const { error } = await admin
    .from("daily_hype_raw")
    .upsert(rows, { onConflict: "date,source" });

  if (error) {
    console.error("[fetch-daily-hype] upsert failed", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = {
    date: today,
    counts: {
      google_trends_rss: gtRss.length,
      google_trends_realtime: gtRealtime.length,
      reddit: reddit.length,
      youtube_trending: ytTrending.length,
      youtube_shorts: ytShorts.length,
      youtube_music: ytMusic.length,
      total: googleAll.length + reddit.length + youtubeAll.length,
    },
  };
  console.log("[fetch-daily-hype] ok", summary);
  return new Response(JSON.stringify({ ok: true, ...summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
