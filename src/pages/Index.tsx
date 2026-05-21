import { motion } from 'framer-motion';
import { useInfluencer } from '@/hooks/useInfluencer';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserStrategies } from '@/hooks/useUserStrategies';
import { useUserUsage } from '@/hooks/useUserUsage';
import { useWallet } from '@/hooks/useWallet';
import { getPillarColor, getPillarEmoji } from '@/data/strategies';
import { NicheIcon } from '@/components/NicheIcon';
import { HypeOfTheDay } from '@/components/HypeOfTheDay';
import { CheckoutModal } from '@/components/CheckoutModal';
import { ChevronRight, Calendar, LogOut, Crown, HelpCircle, Sun, Moon, Flame, Coins } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { InstallVideoModal, INSTALL_VIDEO_SEEN_KEY } from '@/components/InstallVideoModal';
import { useAppTheme } from '@/hooks/useAppTheme';
import logoDark from '@/assets/vyrallab-logo-horizontal.png';
import logoLight from '@/assets/vyrallab-logo-light.png';


const Index = () => {
  const { strategies, loading: strategiesLoading } = useUserStrategies();
  const { state } = useInfluencer(strategies);
  const { profile, signOut } = useUserProfile();
  const { isPremium, freeLimits } = useUserUsage();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [installVideoOpen, setInstallVideoOpen] = useState(false);
  const { isDark, toggle: toggleTheme } = useAppTheme();


  useEffect(() => {
    if (!profile?.onboarding_completed) return;
    let seen = false;
    try { seen = !!localStorage.getItem(INSTALL_VIDEO_SEEN_KEY); } catch {}
    if (seen) return;

    const isStandalone =
      (window.navigator as any).standalone === true ||
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

  if (strategiesLoading && strategies.length === 0) {
    return (
      <div className="min-h-screen pb-24 md:pt-20 relative overflow-hidden">
        <div className="app-neon-orb" style={{ width: 380, height: 380, background: 'hsl(270 90% 55%)', top: -140, left: -120 }} />
        <div className="relative z-10 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
          <div className="max-w-lg mx-auto space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="px-4 max-w-lg mx-auto space-y-4 relative z-10">
          <Skeleton className="h-24 w-full rounded-2xl" />
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
      {/* Background neon orbs (apenas no tema dark) */}
      {isDark && (
        <>
          <div className="app-neon-orb" style={{ width: 460, height: 460, background: 'hsl(270 95% 60%)', top: -180, left: -160 }} />
          <div className="app-neon-orb" style={{ width: 360, height: 360, background: 'hsl(322 90% 60%)', top: 240, right: -140 }} />
          <div className="app-neon-orb" style={{ width: 300, height: 300, background: 'hsl(258 85% 55%)', bottom: -100, left: -80, opacity: 0.3 }} />
        </>
      )}

      <div className="relative z-10 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-5">
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-lg mx-auto space-y-4"
        >
          <div className="flex items-center justify-between">
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
          </div>

          {/* Saudação + chips inline */}
          <div className="space-y-2">
            <h1 className="font-serif text-3xl font-bold text-foreground leading-tight">
              Olá, <span className="bg-clip-text text-transparent bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))]">{displayName}</span> 👑
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="app-neon-chip">
                <Calendar size={12} /> Dia {state.currentDay}/30
              </span>
              <span className="app-neon-chip">
                <Flame size={12} /> {state.streak} {state.streak === 1 ? 'dia' : 'dias'}
              </span>
              <button onClick={() => navigate('/carteira')} className="app-neon-chip hover:brightness-110 transition">
                <Coins size={12} /> {coins} coins
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="relative z-10 px-4 max-w-lg mx-auto space-y-4">
        {profile && profile.description_status === 'pending' && profile.onboarding_completed && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
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

        {!isPremium && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="app-neon-border p-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-primary/15 border border-primary/40 shrink-0">
                <Crown size={18} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Plano Gratuito</p>
                <p className="text-xs text-muted-foreground truncate">
                  {state.currentDay <= freeLimits.free_days
                    ? `${freeLimits.free_days - state.currentDay + 1} dias grátis restantes`
                    : 'Desbloqueie os 30 dias completos'}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => setCheckoutOpen(true)} className="shrink-0 text-primary-foreground bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))] shadow-md shadow-primary/30 hover:brightness-110">
              Assinar
            </Button>
          </motion.div>
        )}

        {/* Card do dia (estratégia) */}
        {todayStrategy && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
          >
            <Link to="/script" className="block app-neon-border p-5 transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 min-w-0">
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${getPillarColor(todayStrategy.pillar)}`}>
                    <NicheIcon id={todayStrategy.pillar} fallbackEmoji={getPillarEmoji(todayStrategy.pillar)} size={16} /> {todayStrategy.pillarLabel}
                  </span>
                  <h3 className="font-serif text-lg font-semibold text-foreground line-clamp-2">
                    {todayStrategy.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {todayStrategy.viralHook}
                  </p>
                </div>
                <ChevronRight size={20} className="text-muted-foreground mt-2 group-hover:text-primary transition-colors shrink-0" />
              </div>
            </Link>
          </motion.div>
        )}

        {/* HERO: Hype do dia */}
        <HypeOfTheDay />
      </div>

      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
      <InstallVideoModal open={installVideoOpen} onOpenChange={setInstallVideoOpen} />
    </div>
  );
};

export default Index;
