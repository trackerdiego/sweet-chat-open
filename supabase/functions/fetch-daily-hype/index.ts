// fetch-daily-hype — cron diário (06h BRT / 09h UTC).
// Coleta trends de Google Trends BR + Reddit + YouTube e grava em daily_hype_raw
// (1 row por fonte por dia). Compartilhado entre todos os users.
//
// Proteção: header `x-cron-secret` deve bater com env CRON_SECRET, senão 401.
// Pode ser chamada manualmente pra forçar refresh.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchGoogleTrendsBR, fetchReddit, fetchYouTubeTrendingBR } from "../_shared/hype-sources.ts";

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

  const [trends, reddit, youtube] = await Promise.all([
    fetchGoogleTrendsBR(),
    fetchReddit(),
    fetchYouTubeTrendingBR(youtubeKey),
  ]);

  const rows = [
    { date: today, source: "google_trends", trends },
    { date: today, source: "reddit", trends: reddit },
    { date: today, source: "youtube", trends: youtube },
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
    counts: { google_trends: trends.length, reddit: reddit.length, youtube: youtube.length },
  };
  console.log("[fetch-daily-hype] ok", summary);
  return new Response(JSON.stringify({ ok: true, ...summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
