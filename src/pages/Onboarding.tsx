import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useOnboardingRun, type StageKey } from '@/hooks/useOnboardingRun';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Loader2, Sparkles, Check, X, Users, Brain, LayoutGrid, UserCircle } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

const contentStyles = [
  { id: 'casual', label: 'Casual', description: 'Leve e descontraído, como conversa entre amigos', emoji: '😊' },
  { id: 'profissional', label: 'Profissional', description: 'Autoritário e informativo, com dados e dicas', emoji: '📊' },
  { id: 'divertido', label: 'Divertido', description: 'Engraçado e irreverente, com memes e trends', emoji: '🎉' },
];

const STAGE_META: Record<StageKey, { title: string; description: string; icon: typeof Users }> = {
  profile: {
    title: 'Preparando seu perfil',
    description: 'Salvando suas informações',
    icon: UserCircle,
  },
  audience: {
    title: 'Analisando seu público',
    description: 'Mapeando perfil, dores e desejos da sua audiência',
    icon: Users,
  },
  visceral: {
    title: 'Construindo estudo visceral',
    description: 'Decifrando gatilhos emocionais e linguagem profunda',
    icon: Brain,
  },
  matrix: {
    title: 'Montando sua matriz de 30 dias',
    description: 'Criando estratégia diária personalizada com gatilhos virais',
    icon: LayoutGrid,
  },
};

const STAGE_ORDER: StageKey[] = ['profile', 'audience', 'visceral', 'matrix'];

const Onboarding = () => {
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const isReturningUser = !!profile && profile.primary_niche !== 'lifestyle' && profile.primary_niche.length < 80;

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [businessDescription, setBusinessDescription] = useState(
    profile?.primary_niche && profile.primary_niche !== 'lifestyle' ? profile.primary_niche : ''
  );
  const [contentStyle, setContentStyle] = useState(profile?.content_style || 'casual');
  const [showPipeline, setShowPipeline] = useState(false);

  const { run, matrixValidated, starting, error, start, resume } = useOnboardingRun();

  const canAdvance = () => {
    if (step === 0) return displayName.trim().length >= 2;
    if (step === 1) return businessDescription.trim().length >= 80;
    if (step === 2) return !!contentStyle;
    return false;
  };

  // Tenta retomar um run em andamento ao montar
  useEffect(() => {
    (async () => {
      const existing = await resume();
      if (existing && (existing.status === 'pending' || existing.status === 'running' || existing.status === 'completed')) {
        setShowPipeline(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quando o run termina, finaliza
  useEffect(() => {
    if (!run) return;
    if (run.status === 'completed' && matrixValidated) {
      toast.success('✨ Tudo pronto! Sua experiência personalizada está montada.');
      try { localStorage.removeItem('influlab.onboardingRunId'); } catch {}
      setTimeout(() => window.location.replace('/'), 900);
    } else if (run.status === 'failed') {
      toast.error('Tivemos um problema em uma das etapas. Toque em "Tentar novamente".');
    }
  }, [run, matrixValidated]);

  const handleFinish = async () => {
    // Re-check session
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast.error('Sua sessão expirou. Faça login novamente.');
      setTimeout(() => navigate('/auth'), 800);
      return;
    }

    try {
      await start({
        displayName: displayName.trim(),
        primaryNiche: businessDescription.trim(),
        secondaryNiches: [],
        contentStyle,
      });
      setShowPipeline(true);
    } catch (e: any) {
      const msg = e?.message || 'Não foi possível iniciar o onboarding.';
      toast.error(msg);
    }
  };

  const handleRetry = async () => {
    try {
      await start({
        displayName: displayName.trim() || profile?.display_name || '',
        primaryNiche: businessDescription.trim() || profile?.primary_niche || '',
        secondaryNiches: [],
        contentStyle: contentStyle || profile?.content_style || 'casual',
      });
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao reiniciar.');
    }
  };

  // ===== Tela de pipeline (4 etapas com polling) =====
  if (showPipeline) {
    const stages = run?.stages || STAGE_ORDER.map((k) => ({ key: k, label: STAGE_META[k].title, status: 'pending' as const }));
    const allDone = run?.status === 'completed' && matrixValidated;
    const failed = run?.status === 'failed';

    return (
      <div className="min-h-screen flex flex-col">
        <div className="gradient-header px-4 pt-10 pb-12 rounded-b-3xl text-center">
          <span className="font-serif text-xl font-bold text-primary">InfluLab</span>
          <p className="text-white/60 text-sm mt-1">Personalizando sua experiência</p>
        </div>
        <div className="flex-1 flex flex-col items-center px-4 -mt-6 pb-10">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center space-y-2">
              <span className="text-4xl">{allDone ? '✨' : failed ? '⚠️' : '⏳'}</span>
              <h2 className="font-serif text-2xl font-bold">
                {allDone
                  ? 'Tudo pronto!'
                  : failed
                  ? 'Vamos tentar de novo'
                  : `Quase lá, ${(displayName || profile?.display_name || '').split(' ')[0]}`}
              </h2>
              <p className="text-muted-foreground text-sm">
                {allDone
                  ? 'Redirecionando para o app…'
                  : failed
                  ? 'Uma das etapas falhou. Pode tentar novamente abaixo.'
                  : 'Pode fechar e voltar mais tarde — vamos retomar de onde parou.'}
              </p>
            </div>

            <div className="space-y-3">
              {STAGE_ORDER.map((key, idx) => {
                const meta = STAGE_META[key];
                const stage = stages.find((s) => s.key === key) || { key, label: meta.title, status: 'pending' as const };
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className={`glass-card p-4 flex items-start gap-3 transition-all ${
                      stage.status === 'running' ? 'ring-2 ring-primary/50 bg-primary/5' :
                      stage.status === 'done' ? 'opacity-90' :
                      stage.status === 'error' ? 'ring-2 ring-destructive/50 bg-destructive/5' :
                      'opacity-60'
                    }`}
                  >
                    <div className={`shrink-0 size-10 rounded-xl flex items-center justify-center ${
                      stage.status === 'done' ? 'bg-emerald-500/15 text-emerald-500' :
                      stage.status === 'error' ? 'bg-destructive/15 text-destructive' :
                      stage.status === 'running' ? 'gold-gradient text-primary-foreground' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {stage.status === 'done' ? <Check size={20} /> :
                       stage.status === 'error' ? <X size={20} /> :
                       stage.status === 'running' ? <Loader2 size={20} className="animate-spin" /> :
                       <Icon size={20} />}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium text-sm">{meta.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {stage.status === 'error' && stage.error ? stage.error : meta.description}
                      </p>
                      {stage.status === 'done' && stage.source === 'fallback' && (
                        <p className="text-[10px] text-amber-500">Gerado em modo seguro</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {failed && (
              <div className="space-y-2">
                <Button
                  onClick={handleRetry}
                  disabled={starting}
                  className="w-full gold-gradient text-primary-foreground shadow-md shadow-primary/20"
                >
                  {starting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Tentar novamente
                </Button>
                {run?.error_message && (
                  <p className="text-xs text-muted-foreground text-center">Detalhe técnico: {run.error_message}</p>
                )}
              </div>
            )}

            {!failed && !allDone && (
              <p className="text-xs text-muted-foreground text-center">
                O processamento roda no servidor. Mesmo se sua conexão cair, o trabalho continua.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== Form (3 passos) =====
  const steps = [
    <motion.div key="name" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="space-y-6">
      <div className="text-center space-y-2">
        <span className="text-4xl">✨</span>
        <h2 className="font-serif text-2xl font-bold">Como te chamamos?</h2>
        <p className="text-muted-foreground text-sm">Esse nome aparecerá na sua saudação diária</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Seu nome</Label>
        <Input id="name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Ex: Marina, João, Bia..." className="text-center text-lg" autoFocus />
      </div>
    </motion.div>,

    <motion.div key="description" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="space-y-5">
      {isReturningUser && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm space-y-1">
          <p className="font-medium text-amber-600">⚠️ Sua descrição anterior ficou muito curta</p>
          <p className="text-muted-foreground text-xs">Sem uma descrição detalhada, o estudo de público e a matriz de conteúdo não conseguem ser precisos.</p>
        </motion.div>
      )}
      <div className="text-center space-y-2">
        <span className="text-4xl">🎯</span>
        <h2 className="font-serif text-2xl font-bold">Quanto mais você descrever, melhor será sua experiência</h2>
        <p className="text-muted-foreground text-sm">A IA usa sua descrição para criar seu estudo de público, matriz de 30 dias e roteiros personalizados</p>
      </div>
      <div className="space-y-3">
        <Label htmlFor="description">Descreva seu trabalho e público</Label>
        <Textarea
          id="description"
          value={businessDescription}
          onChange={e => setBusinessDescription(e.target.value)}
          placeholder={"Ex: Sou nutricionista especializada em emagrecimento feminino pós-gravidez. Meu público são mães de 25 a 40 anos que querem perder peso de forma saudável sem dietas restritivas. Quero me posicionar como autoridade e vender consultorias online."}
          className="min-h-[130px] text-sm"
          autoFocus
        />
        <p className={`text-xs font-medium ${
          businessDescription.trim().length >= 80 ? 'text-emerald-500' :
          businessDescription.trim().length >= 50 ? 'text-yellow-500' :
          'text-muted-foreground'
        }`}>
          {businessDescription.trim().length}/80 caracteres mínimos
          {businessDescription.trim().length >= 80 && ' ✓'}
          {businessDescription.trim().length >= 50 && businessDescription.trim().length < 80 && ' — quase lá!'}
        </p>
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer">
            <Sparkles size={12} /> Dicas para uma descrição poderosa
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1.5">
            <p>Responda mentalmente essas perguntas:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Qual seu nicho principal?</strong> (ex: fitness, finanças, moda)</li>
              <li><strong>Quem é seu público-alvo?</strong> (idade, perfil, dor principal)</li>
              <li><strong>Qual seu objetivo?</strong> (vender curso, ganhar seguidores, ser autoridade)</li>
              <li><strong>Que resultado quer gerar?</strong> (engajamento, vendas, comunidade)</li>
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </motion.div>,

    <motion.div key="style" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="space-y-6">
      <div className="text-center space-y-2">
        <span className="text-4xl">🎭</span>
        <h2 className="font-serif text-2xl font-bold">Seu estilo de conteúdo</h2>
        <p className="text-muted-foreground text-sm">Como você quer se comunicar?</p>
      </div>
      <div className="space-y-3">
        {contentStyles.map(style => (
          <button
            key={style.id}
            onClick={() => setContentStyle(style.id)}
            className={`w-full glass-card p-4 text-left transition-all flex items-start gap-3 ${contentStyle === style.id ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-muted/50'}`}
          >
            <span className="text-2xl">{style.emoji}</span>
            <div>
              <p className="font-medium text-sm">{style.label}</p>
              <p className="text-xs text-muted-foreground">{style.description}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>,
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <div className="gradient-header px-4 pt-10 pb-12 rounded-b-3xl text-center">
        <span className="font-serif text-xl font-bold text-primary">InfluLab</span>
        <p className="text-white/60 text-sm mt-1">Configure seu perfil</p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'gold-gradient' : 'bg-muted'}`} />
            ))}
          </div>
          <AnimatePresence mode="wait">{steps[step]}</AnimatePresence>
          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}
          <div className="flex gap-3">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1" disabled={starting}>
                <ArrowLeft size={16} /> Voltar
              </Button>
            )}
            {step < 2 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canAdvance()} className="flex-1 gold-gradient text-primary-foreground shadow-md shadow-primary/20">
                Próximo <ArrowRight size={16} />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={starting || !canAdvance()} className="flex-1 gold-gradient text-primary-foreground shadow-md shadow-primary/20">
                {starting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {starting ? 'Iniciando...' : 'Começar Jornada'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
