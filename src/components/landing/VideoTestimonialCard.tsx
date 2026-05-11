import { VideoEmbed } from "./VideoEmbed";
import { TrendingUp } from "lucide-react";

export interface VideoTestimonial {
  provider: "youtube" | "wistia";
  videoId: string;
  name: string;
  handle?: string;
  niche: string;
  metric?: string;
  quote?: string;
}

export function VideoTestimonialCard({ t }: { t: VideoTestimonial }) {
  return (
    <div className="flex flex-col gap-3">
      <VideoEmbed
        provider={t.provider}
        videoId={t.videoId}
        title={`Depoimento de ${t.name}`}
        aspect="9/16"
      />
      <div className="px-1">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div>
            <p className="text-sm font-semibold text-white leading-tight">
              {t.name}
            </p>
            {t.handle && (
              <p className="text-xs text-white/50">{t.handle} · {t.niche}</p>
            )}
            {!t.handle && (
              <p className="text-xs text-white/50">{t.niche}</p>
            )}
          </div>
        </div>
        {t.metric && (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary/15 rounded-full px-2.5 py-1 border border-primary/20">
            <TrendingUp className="h-3 w-3" />
            {t.metric}
          </div>
        )}
        {t.quote && (
          <p className="text-xs text-white/60 mt-2 leading-relaxed italic">
            "{t.quote}"
          </p>
        )}
      </div>
    </div>
  );
}
