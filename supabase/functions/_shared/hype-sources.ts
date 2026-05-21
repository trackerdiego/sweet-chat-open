// hype-sources.ts — coleta de trends brasileiros de fontes gratuitas focadas
// em criação de conteúdo. SEM portais de notícia genéricos (UOL/G1).
// Usado por fetch-daily-hype (cron diário) e como fallback em start-hype-job.

export interface RawTrend {
  source: "google_trends" | "reddit" | "youtube";
  subsource?: string; // ex: "realtime", "shorts", "music"
  title: string;
  category?: string;
  context?: string;
  url?: string;
  score?: number; // ranking relativo (maior = mais quente)
}

const UA = "Mozilla/5.0 (compatible; InfluLabHypeBot/1.0; +https://influlab.pro)";

// ---------- Google Trends BR (RSS público) ----------
export async function fetchGoogleTrendsBR(): Promise<RawTrend[]> {
  try {
    const res = await fetch("https://trends.google.com/trending/rss?geo=BR", {
      headers: { "User-Agent": UA, "Accept": "application/rss+xml,application/xml,text/xml" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[hype-sources] google trends rss status ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items: RawTrend[] = [];
    const itemBlocks = xml.split("<item>").slice(1);
    for (const block of itemBlocks) {
      const title = extractTag(block, "title");
      const traffic = extractTag(block, "ht:approx_traffic");
      const newsTitles = [...block.matchAll(/<ht:news_item_title>(.*?)<\/ht:news_item_title>/gs)]
        .map((m) => decode(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")));
      if (title) {
        items.push({
          source: "google_trends",
          subsource: "rss",
          title: decode(title),
          context: newsTitles.slice(0, 2).join(" • ") || undefined,
          score: traffic ? parseInt(traffic.replace(/\D/g, "")) || 0 : 0,
        });
      }
    }
    return items.slice(0, 25);
  } catch (e) {
    console.warn("[hype-sources] google trends rss failed", e);
    return [];
  }
}

// ---------- Google Trends Realtime BR (JSON endpoint, mais estável) ----------
export async function fetchGoogleTrendsRealtimeBR(): Promise<RawTrend[]> {
  try {
    const url = "https://trends.google.com/trends/api/dailytrends?hl=pt-BR&tz=180&geo=BR&ns=15";
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[hype-sources] google trends realtime status ${res.status}`);
      return [];
    }
    let body = await res.text();
    // Google prefixa com )]}',\n pra prevenir JSON hijacking
    body = body.replace(/^\)\]\}'?,?\s*/, "");
    const json = JSON.parse(body);
    const days = json?.default?.trendingSearchesDays ?? [];
    const items: RawTrend[] = [];
    for (const day of days) {
      for (const t of day.trendingSearches ?? []) {
        const title = t?.title?.query ?? "";
        if (!title) continue;
        const traffic = String(t?.formattedTraffic ?? "").replace(/\D/g, "");
        const articles = (t?.articles ?? []).slice(0, 2).map((a: any) => a?.title ?? "").filter(Boolean);
        items.push({
          source: "google_trends",
          subsource: "realtime",
          title,
          context: articles.join(" • ") || undefined,
          score: traffic ? parseInt(traffic) || 0 : 0,
        });
      }
    }
    return items.slice(0, 30);
  } catch (e) {
    console.warn("[hype-sources] google trends realtime failed", e);
    return [];
  }
}

// ---------- Reddit BR (best-effort, costuma 403 em IP de datacenter) ----------
export async function fetchReddit(): Promise<RawTrend[]> {
  const subs = ["brasil", "popular"];
  const all: RawTrend[] = [];
  for (const sub of subs) {
    try {
      const url = sub === "popular"
        ? "https://www.reddit.com/r/popular/hot.json?geo_filter=BR&limit=20"
        : `https://www.reddit.com/r/${sub}/hot.json?limit=20`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.warn(`[hype-sources] reddit ${sub} status ${res.status} (esperado em datacenter IPs)`);
        continue;
      }
      const json = await res.json() as { data?: { children?: Array<{ data: Record<string, unknown> }> } };
      for (const child of json.data?.children ?? []) {
        const d = child.data;
        if (d.stickied) continue;
        all.push({
          source: "reddit",
          title: String(d.title ?? "").slice(0, 200),
          category: `r/${d.subreddit ?? sub}`,
          context: String(d.selftext ?? "").slice(0, 200) || undefined,
          url: d.permalink ? `https://reddit.com${d.permalink}` : undefined,
          score: typeof d.score === "number" ? d.score : 0,
        });
      }
    } catch (e) {
      console.warn(`[hype-sources] reddit ${sub} fetch failed`, e);
    }
  }
  return all.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 30);
}

// ---------- YouTube Trending BR (vídeos mais populares geral) ----------
export async function fetchYouTubeTrendingBR(apiKey: string): Promise<RawTrend[]> {
  if (!apiKey) return [];
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,statistics");
    url.searchParams.set("chart", "mostPopular");
    url.searchParams.set("regionCode", "BR");
    url.searchParams.set("maxResults", "25");
    url.searchParams.set("key", apiKey);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`[hype-sources] youtube trending status ${res.status}`, await res.text().catch(() => ""));
      return [];
    }
    const json = await res.json() as { items?: Array<{ id: string; snippet: Record<string, unknown>; statistics?: Record<string, unknown> }> };
    return (json.items ?? []).map((v) => ({
      source: "youtube" as const,
      subsource: "trending",
      title: String(v.snippet.title ?? "").slice(0, 200),
      category: String(v.snippet.channelTitle ?? ""),
      context: String(v.snippet.description ?? "").slice(0, 200) || undefined,
      url: `https://youtube.com/watch?v=${v.id}`,
      score: parseInt(String(v.statistics?.viewCount ?? "0")) || 0,
    }));
  } catch (e) {
    console.warn("[hype-sources] youtube trending failed", e);
    return [];
  }
}

// ---------- YouTube Shorts BR (busca por #shorts publicados últimas 24h) ----------
export async function fetchYouTubeShortsBR(apiKey: string): Promise<RawTrend[]> {
  if (!apiKey) return [];
  try {
    const publishedAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("regionCode", "BR");
    url.searchParams.set("relevanceLanguage", "pt");
    url.searchParams.set("q", "#shorts");
    url.searchParams.set("order", "viewCount");
    url.searchParams.set("publishedAfter", publishedAfter);
    url.searchParams.set("maxResults", "20");
    url.searchParams.set("key", apiKey);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`[hype-sources] youtube shorts status ${res.status}`, await res.text().catch(() => ""));
      return [];
    }
    const json = await res.json() as { items?: Array<{ id: { videoId?: string }; snippet: Record<string, unknown> }> };
    return (json.items ?? [])
      .filter((v) => v.id?.videoId)
      .map((v) => ({
        source: "youtube" as const,
        subsource: "shorts",
        title: String(v.snippet.title ?? "").slice(0, 200),
        category: String(v.snippet.channelTitle ?? ""),
        context: String(v.snippet.description ?? "").slice(0, 200) || undefined,
        url: `https://youtube.com/shorts/${v.id.videoId}`,
        score: 0, // search.list não retorna stats; tratamos como score neutro
      }));
  } catch (e) {
    console.warn("[hype-sources] youtube shorts failed", e);
    return [];
  }
}

// ---------- YouTube Music Trending BR (áudios virais — ouro pra Reels/TikTok) ----------
export async function fetchYouTubeMusicTrendingBR(apiKey: string): Promise<RawTrend[]> {
  if (!apiKey) return [];
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,statistics");
    url.searchParams.set("chart", "mostPopular");
    url.searchParams.set("regionCode", "BR");
    url.searchParams.set("videoCategoryId", "10"); // Music
    url.searchParams.set("maxResults", "20");
    url.searchParams.set("key", apiKey);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`[hype-sources] youtube music status ${res.status}`, await res.text().catch(() => ""));
      return [];
    }
    const json = await res.json() as { items?: Array<{ id: string; snippet: Record<string, unknown>; statistics?: Record<string, unknown> }> };
    return (json.items ?? []).map((v) => ({
      source: "youtube" as const,
      subsource: "music",
      title: String(v.snippet.title ?? "").slice(0, 200),
      category: `🎵 ${v.snippet.channelTitle ?? ""}`,
      context: String(v.snippet.description ?? "").slice(0, 200) || undefined,
      url: `https://youtube.com/watch?v=${v.id}`,
      score: parseInt(String(v.statistics?.viewCount ?? "0")) || 0,
    }));
  } catch (e) {
    console.warn("[hype-sources] youtube music failed", e);
    return [];
  }
}

function extractTag(s: string, tag: string): string {
  const m = s.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!m) return "";
  return decode(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")).trim();
}
function decode(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
