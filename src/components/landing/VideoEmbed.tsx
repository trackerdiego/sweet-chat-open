import { useRef, useState } from "react";
import { useInView } from "framer-motion";
import { Play } from "lucide-react";

type Provider = "youtube" | "wistia";

interface VideoEmbedProps {
  provider: Provider;
  videoId: string;
  title?: string;
  /** 16/9 (default) | 9/16 (vertical) */
  aspect?: "16/9" | "9/16";
  thumbnailUrl?: string;
  className?: string;
}

/**
 * Lazy-load video embed: only mounts the iframe once it scrolls into view
 * and the user clicks play. Keeps initial page weight tiny.
 */
export function VideoEmbed({
  provider,
  videoId,
  title = "Vídeo",
  aspect = "16/9",
  thumbnailUrl,
  className = "",
}: VideoEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const [active, setActive] = useState(false);

  const aspectClass = aspect === "9/16" ? "aspect-[9/16]" : "aspect-video";

  const computedThumb =
    thumbnailUrl ??
    (provider === "youtube"
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      : undefined);

  const src =
    provider === "youtube"
      ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`
      : `https://fast.wistia.net/embed/iframe/${videoId}?autoPlay=true`;

  return (
    <div
      ref={ref}
      className={`relative ${aspectClass} w-full overflow-hidden rounded-2xl bg-charcoal/60 ring-1 ring-white/10 shadow-2xl shadow-primary/20 ${className}`}
    >
      {active && inView ? (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          aria-label={`Reproduzir ${title}`}
          className="group absolute inset-0 flex items-center justify-center"
        >
          {computedThumb ? (
            <img
              src={computedThumb}
              alt={title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-charcoal to-accent/20" />
          )}
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/95 shadow-lg shadow-primary/40 transition-transform group-hover:scale-110">
            <Play className="h-7 w-7 fill-primary-foreground text-primary-foreground ml-0.5" />
          </span>
        </button>
      )}
    </div>
  );
}
