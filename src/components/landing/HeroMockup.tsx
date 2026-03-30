import { Calendar, BarChart3, FileText, Sparkles } from "lucide-react";

export function LandingHeroMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Notebook frame */}
      <div className="relative rounded-xl border border-white/15 bg-charcoal-light/80 shadow-2xl shadow-primary/10 overflow-hidden backdrop-blur-sm">
        {/* Top bar */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/10 bg-white/5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
          <div className="ml-3 flex-1 h-5 rounded-md bg-white/10 max-w-[180px]" />
        </div>

        {/* Screen content */}
        <div className="p-5 space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="h-3 w-20 rounded bg-white/20" />
                <div className="h-2 w-14 rounded bg-white/10 mt-1" />
              </div>
            </div>
            <div className="h-6 w-16 rounded-full bg-primary/25 flex items-center justify-center">
              <span className="text-[10px] text-primary font-medium">Dia 7</span>
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
              <Calendar className="w-4 h-4 text-primary mb-2" />
              <div className="h-2.5 w-16 rounded bg-white/15 mb-1" />
              <div className="h-2 w-12 rounded bg-white/8" />
            </div>
            <div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
              <BarChart3 className="w-4 h-4 text-accent mb-2" />
              <div className="h-2.5 w-14 rounded bg-white/15 mb-1" />
              <div className="h-2 w-10 rounded bg-white/8" />
            </div>
          </div>

          {/* Script preview */}
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <div className="h-2.5 w-24 rounded bg-white/15" />
            </div>
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded bg-white/8" />
              <div className="h-2 w-[85%] rounded bg-white/8" />
              <div className="h-2 w-[70%] rounded bg-white/8" />
            </div>
          </div>
        </div>
      </div>

      {/* Phone frame — floating on top */}
      <div className="absolute -bottom-6 -right-4 w-32 rounded-xl border border-white/15 bg-charcoal-light/90 shadow-xl shadow-primary/10 overflow-hidden backdrop-blur-sm">
        <div className="h-4 border-b border-white/10 flex items-center justify-center">
          <div className="w-8 h-1 rounded-full bg-white/15" />
        </div>
        <div className="p-2 space-y-2">
          <div className="h-3 w-full rounded bg-primary/20" />
          <div className="grid grid-cols-2 gap-1">
            <div className="h-8 rounded bg-primary/15" />
            <div className="h-8 rounded bg-accent/15" />
          </div>
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded bg-white/10" />
            <div className="h-1.5 w-3/4 rounded bg-white/10" />
          </div>
          <div className="h-5 rounded-md bg-primary/25 flex items-center justify-center">
            <span className="text-[7px] text-primary font-medium">Gerar Script</span>
          </div>
        </div>
      </div>
    </div>
  );
}
