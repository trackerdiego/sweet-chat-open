import { motion } from 'framer-motion';
import { useInfluencer } from '@/hooks/useInfluencer';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserStrategies } from '@/hooks/useUserStrategies';
import { useUserUsage } from '@/hooks/useUserUsage';
import { useWallet } from '@/hooks/useWallet';
import { getPillarEmoji } from '@/data/strategies';
import { NicheIcon } from '@/components/NicheIcon';
import { GiftUnlockCard } from '@/components/GiftUnlockCard';
import { QuickAccessGrid } from '@/components/QuickAccessGrid';
import { CheckoutModal } from '@/components/CheckoutModal';
import { ArrowRight, LogOut, Crown, HelpCircle, Sun, Moon, Flame, Coins } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect, useMemo } from 'react';
import { InstallVideoModal, INSTALL_VIDEO_SEEN_KEY } from '@/components/InstallVideoModal';
import { useAppTheme } from '@/hooks/useAppTheme';
import logoDark from '@/assets/vyrallab-logo-horizontal.png';
import logoLight from '@/assets/vyrallab-logo-light.png';

function greetingByHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const Index = () => {
  const { strategies, loading: strategiesLoading } = useUserStrategies();
  const { state } = useInfluencer(strategies);
  const { profile, signOut } = useUserProfile();
  const { isPremium } = useUserUsage();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [installVideoOpen, setInstallVideoOpen] = useState(false);
  const { isDark, toggle: toggleTheme } = useAppTheme();

  useEffect(() => {
    if (!profile?.onboarding_completed) return;
    let seen = false;
    try { seen = !!localStorage.getItem(INSTALL_VIDEO_SEEN_KEY); } catch { /* ignore */ }
    if (seen) return;

    const isStandalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    let inIframe = false;
    try { inIframe = window.self !== window.top; } catch { inIframe = true; }
    const isPreview =
      window.location.hostname.includes('id-preview--') ||
      window.location.hostname.includes('lovableproject.com');
    if (inIframe || isPreview) return;

    const t = setTimeout(() => setInstallVideoOpen(true), 800);
    return () => clearTimeout(t);
  }, [profile?.onboarding_completed]);

  const greeting = useMemo(greetingByHour, []);

  if (strategiesLoading && strategies.length === 0) {
    return (
      <div className="min-h-screen pb-24 md:pt-20 relative overflow-hidden">
        {isDark && <div className="app-neon-orb" style={{ width: 380, height: 380, background: 'hsl(270 90% 55%)', top: -140, left: -120 }} />}
        <div className="relative z-10 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
          <div className="max-w-lg mx-auto space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="px-4 max-w-lg mx-auto space-y-4 relative z-10">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const todayStrategy = strategies[state.currentDay - 1];
  const displayName = profile?.display_name || 'Creator';
  const coins = wallet?.coins_balance ?? 0;

  return (
    <div className="min-h-screen pb-24 md:pt-20 relative overflow-hidden">
      {isDark && (
        <>
          <div className="app-neon-orb" style={{ width: 460, height: 460, background: 'hsl(270 95% 60%)', top: -180, left: -160 }} />
          <div className="app-neon-orb" style={{ width: 360, height: 360, background: 'hsl(322 90% 60%)', top: 240, right: -140 }} />
          <div className="app-neon-orb" style={{ width: 300, height: 300, background: 'hsl(258 85% 55%)', bottom: -100, left: -80, opacity: 0.3 }} />
        </>
      )}

      {/* Header */}
      <div className="relative z-10 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-3">
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-lg mx-auto flex items-center justify-between"
        >
          <img
            src={isDark ? logoDark : logoLight}
            alt="Vyral Lab"
            className={`h-8 w-auto ${isDark ? 'drop-shadow-[0_0_18px_rgba(168,85,247,0.55)]' : ''}`}
          />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-foreground/70 hover:text-foreground" aria-label="Alternar tema">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/ajuda')} className="text-foreground/70 hover:text-foreground" aria-label="Ajuda">
              <HelpCircle size={18} />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-foreground/70 hover:text-foreground" aria-label="Sair">
              <LogOut size={18} />
            </Button>
          </div>
        </motion.div>
      </div>

      <div className="relative z-10 px-4 max-w-lg mx-auto space-y-5">
        {/* Saudação grande */}
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="space-y-1"
        >
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h1 className="font-serif text-3xl font-bold text-foreground leading-tight">
            <span className="bg-clip-text text-transparent bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))]">{displayName}</span> 👋
          </h1>
          <p className="text-sm text-muted-foreground">Como vamos viralizar hoje?</p>
        </motion.div>

        {/* Avisos */}
        {profile && profile.description_status === 'pending' && profile.onboarding_completed && (
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="rounded-2xl border p-4"
            style={{ borderColor: 'hsl(38 92% 50% / 0.4)', background: 'hsl(38 92% 50% / 0.06)' }}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">⚠️</span>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-foreground">Sua descrição de público está incompleta</p>
                <p className="text-xs text-muted-foreground">
                  Sem uma descrição detalhada, o estudo de público e a matriz de conteúdo não serão precisos.
                </p>
                <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 bg-transparent" onClick={() => navigate('/onboarding')}>
                  Atualizar descrição
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* HERO — Estratégia do dia */}
        {todayStrategy && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
          >
            <Link to="/script" className="app-hero-gradient block p-6 group">
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="space-y-3 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-white/70">
                      Dia {state.currentDay}/30{state.cycle && state.cycle > 1 ? ` · Ciclo ${state.cycle}` : ''}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/40" />
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-white/90">
                      {todayStrategy.pillarLabel}
                    </span>
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-white leading-tight line-clamp-2">
                    {todayStrategy.title}
                  </h2>
                  <p className="text-sm text-white/80 line-clamp-2 leading-relaxed">
                    {todayStrategy.viralHook}
                  </p>
                  <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-white pt-1 group-hover:gap-2.5 transition-all">
                    Abrir roteiro <ArrowRight size={16} />
                  </div>
                </div>
                <div
                  className="shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center bg-white/10 border border-white/20 backdrop-blur-sm"
                  style={{ boxShadow: '0 0 30px hsl(322 90% 65% / 0.4)' }}
                >
                  <NicheIcon id={todayStrategy.pillar} fallbackEmoji={getPillarEmoji(todayStrategy.pillar)} size={32} />
                </div>
              </div>
            </Link>
          </motion.div>
        )}

        {/* Acesso rápido */}
        <QuickAccessGrid />

        {/* Presente bloqueado (libera Trends Virais do YouTube no D8) */}
        <GiftUnlockCard />

        {/* Status (rodapé compacto) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur p-3 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Flame size={14} className="text-orange-500" />
              <strong className="text-foreground">{state.streak}</strong> {state.streak === 1 ? 'dia' : 'dias'}
            </span>
            <span className="text-border">·</span>
            <button onClick={() => navigate('/carteira')} className="inline-flex items-center gap-1.5 hover:text-foreground transition">
              <Coins size={14} className="text-amber-500" />
              <strong className="text-foreground">{coins}</strong> coins
            </button>
          </div>
          {!isPremium ? (
            <Button size="sm" onClick={() => setCheckoutOpen(true)} className="h-8 text-xs text-primary-foreground bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))] shadow-md shadow-primary/30 hover:brightness-110">
              <Crown size={12} className="mr-1" /> Assinar
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-primary font-semibold">
              <Crown size={12} /> Premium
            </span>
          )}
        </motion.div>
      </div>

      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
      <InstallVideoModal open={installVideoOpen} onOpenChange={setInstallVideoOpen} />
    </div>
  );
};

export default Index;
