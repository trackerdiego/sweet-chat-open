// hype-sources.ts — coleta de trends brasileiros de 3 fontes gratuitas.
// Usado por fetch-daily-hype (cron diário) e como fallback em start-hype-job
// quando ainda não existe row em daily_hype_raw pra hoje.

export interface RawTrend {
  source: "google_trends" | "reddit" | "youtube";
  title: string;
  category?: string;
  context?: string;
  url?: string;
  score?: number; // ranking relativo (maior = mais quente)
}

const UA = "Mozilla/5.0 (compatible; InfluLabHypeBot/1.0; +https://influlab.pro)";

// ---------- Google Trends BR (RSS público, sem auth) ----------
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
    // parser RSS minimal — só campos que importam
    const itemBlocks = xml.split("<item>").slice(1);
    for (const block of itemBlocks) {
      const title = extractTag(block, "title");
      const traffic = extractTag(block, "ht:approx_traffic");
      const newsTitles = [...block.matchAll(/<ht:news_item_title>(.*?)<\/ht:news_item_title>/gs)]
        .map((m) => decode(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")));
      if (title) {
        items.push({
          source: "google_trends",
          title: decode(title),
          context: newsTitles.slice(0, 2).join(" • ") || undefined,
          score: traffic ? parseInt(traffic.replace(/\D/g, "")) || 0 : 0,
        });
      }
    }
    return items.slice(0, 25);
  } catch (e) {
    console.warn("[hype-sources] google trends fetch failed", e);
    return [];
  }
}

// ---------- Reddit BR (JSON público, só precisa User-Agent) ----------
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
        console.warn(`[hype-sources] reddit ${sub} status ${res.status}`);
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

// ---------- YouTube Trending BR (Data API v3, free quota) ----------
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
      console.warn(`[hype-sources] youtube status ${res.status}`, await res.text().catch(() => ""));
      return [];
    }
    const json = await res.json() as { items?: Array<{ id: string; snippet: Record<string, unknown>; statistics?: Record<string, unknown> }> };
    return (json.items ?? []).map((v) => ({
      source: "youtube" as const,
      title: String(v.snippet.title ?? "").slice(0, 200),
      category: String(v.snippet.channelTitle ?? ""),
      context: String(v.snippet.description ?? "").slice(0, 200) || undefined,
      url: `https://youtube.com/watch?v=${v.id}`,
      score: parseInt(String(v.statistics?.viewCount ?? "0")) || 0,
    }));
  } catch (e) {
    console.warn("[hype-sources] youtube fetch failed", e);
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
