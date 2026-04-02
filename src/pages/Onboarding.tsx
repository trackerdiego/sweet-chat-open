import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Loader2, Sparkles, Check, Users, Brain, Calendar, RefreshCw, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

const contentStyles = [
  { id: 'casual', label: 'Casual', description: 'Leve e descontraído, como conversa entre amigos', emoji: '😊' },
  { id: 'profissional', label: 'Profissional', description: 'Autoritário e informativo, com dados e dicas', emoji: '📊' },
  { id: 'divertido', label: 'Divertido', description: 'Engraçado e irreverente, com memes e trends', emoji: '🎉' },
];

type PipelineStep = {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  status: 'pending' | 'active' | 'done' | 'error';
};

const INITIAL_STEPS: PipelineStep[] = [
  { id: 'audience', label: 'Analisando seu nicho e público', sublabel: 'Identificando oportunidades...', icon: Users, status: 'pending' },
  { id: 'visceral', label: 'Estudo visceral do seu público', sublabel: 'Mapeando medos, desejos e gatilhos...', icon: Brain, status: 'pending' },
  { id: 'matrix', label: 'Criando sua Matriz de 30 dias', sublabel: 'Construindo estratégias personalizadas...', icon: Calendar, status: 'pending' },
  { id: 'finalize', label: 'Finalizando seu perfil', sublabel: 'Salvando configurações...', icon: CheckCircle, status: 'pending' },
];

const Onboarding = () => {
  const { updateProfile, profile } = useUserProfile();
  const navigate = useNavigate();
  const isReturningUser = !!profile && profile.primary_niche !== 'lifestyle' && profile.primary_niche.length < 80;
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [businessDescription, setBusinessDescription] = useState(
    profile?.primary_niche && profile.primary_niche !== 'lifestyle' ? profile.primary_niche : ''
  );
  const [contentStyle, setContentStyle] = useState(profile?.content_style || 'casual');
  const [saving, setSaving] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [matrixRetryAvailable, setMatrixRetryAvailable] = useState(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopProgressTick = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Smooth progress: increment +1% every 2s, capped at `max`
  const startProgressTick = useCallback((max: number) => {
    stopProgressTick();
    progressIntervalRef.current = setInterval(() => {
      setPipelineProgress(prev => {
        if (prev >= max) return prev;
        return Math.min(prev + 1, max);
      });
    }, 2000);
  }, [stopProgressTick]);

  useEffect(() => {
    return () => stopProgressTick();
  }, [stopProgressTick]);

  const canAdvance = () => {
    if (step === 0) return displayName.trim().length >= 2;
    if (step === 1) return businessDescription.trim().length >= 80;
    if (step === 2) return !!contentStyle;
    return false;
  };

  const updateStepStatus = (stepId: string, status: PipelineStep['status']) => {
    setPipelineSteps(prev => prev.map(s => s.id === stepId ? { ...s, status } : s));
  };

  const runMatrixGeneration = async (): Promise<boolean> => {
    const { error } = await supabase.functions.invoke('generate-personalized-matrix', {
      body: { primaryNiche: businessDescription.trim(), secondaryNiches: [], contentStyle },
    });
    return !error;
  };

  const handleRetryMatrix = async () => {
    setMatrixRetryAvailable(false);
    updateStepStatus('matrix', 'active');
    startProgressTick(90);

    const success = await runMatrixGeneration();
    stopProgressTick();

    if (success) {
      updateStepStatus('matrix', 'done');
      setPipelineProgress(92);
      await finalizeOnboarding();
    } else {
      updateStepStatus('matrix', 'error');
      setMatrixRetryAvailable(true);
      toast.error('A matriz falhou novamente. Tente mais uma vez ou pule.');
    }
  };

  const handleSkipMatrix = async () => {
    setMatrixRetryAvailable(false);
    toast.warning('A matriz será gerada em breve. Você já pode explorar o app!');
    await finalizeOnboarding();
  };

  const finalizeOnboarding = async () => {
    updateStepStatus('finalize', 'active');
    setPipelineProgress(95);

    const completeResult = await updateProfile({ onboarding_completed: true, description_status: 'ok' as any });
    if (completeResult?.error) {
      await new Promise(r => setTimeout(r, 1000));
      const retry = await updateProfile({ onboarding_completed: true });
      if (retry?.error) {
        updateStepStatus('finalize', 'error');
        toast.error('Erro ao finalizar. Tente novamente.');
        return;
      }
    }

    updateStepStatus('finalize', 'done');
    setPipelineProgress(100);
    await new Promise(r => setTimeout(r, 800));
    window.location.replace('/');
  };

  const handleFinish = async () => {
    setSaving(true);

    let result = await updateProfile({
      display_name: displayName.trim(),
      primary_niche: businessDescription.trim(),
      secondary_niches: [],
      content_style: contentStyle,
    });

    if (result?.error) {
      await new Promise(r => setTimeout(r, 1000));
      result = await updateProfile({
        display_name: displayName.trim(),
        primary_niche: businessDescription.trim(),
        secondary_niches: [],
        content_style: contentStyle,
      });
    }

    if (result?.error) {
      try {
        const { error: directError } = await (supabase.from as any)('user_profiles')
          .upsert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            display_name: displayName.trim(),
            primary_niche: businessDescription.trim(),
            secondary_niches: [],
            content_style: contentStyle,
            onboarding_completed: false,
          }, { onConflict: 'user_id' });
        if (directError) {
          toast.error('Erro ao salvar perfil. Tente novamente.');
          setSaving(false);
          return;
        }
      } catch {
        toast.error('Erro ao salvar perfil. Tente novamente.');
        setSaving(false);
        return;
      }
    }

    setShowPipeline(true);
    setPipelineProgress(3);

    // --- Step 1 & 2: Audience profile ---
    updateStepStatus('audience', 'active');
    startProgressTick(25); // tick up to 25% while waiting

    // Simulate step 1 completing after ~12s (audience description is faster)
    const step1Timer = setTimeout(() => {
      updateStepStatus('audience', 'done');
      setPipelineProgress(prev => Math.max(prev, 25));
      updateStepStatus('visceral', 'active');
      // Now tick up to 50%
      startProgressTick(50);
    }, 12000);

    const { error: audienceError } = await supabase.functions.invoke('generate-audience-profile', {
      body: { primaryNiche: businessDescription.trim(), secondaryNiches: [], contentStyle },
    });

    clearTimeout(step1Timer);
    stopProgressTick();

    if (audienceError) {
      updateStepStatus('audience', 'error');
      updateStepStatus('visceral', 'error');
      setPipelineProgress(50);
    } else {
      updateStepStatus('audience', 'done');
      updateStepStatus('visceral', 'done');
      setPipelineProgress(52);
    }

    // --- Step 3: Matrix ---
    updateStepStatus('matrix', 'active');
    startProgressTick(85);

    let matrixSuccess = await runMatrixGeneration();

    if (!matrixSuccess) {
      // Retry once after 3s
      stopProgressTick();
      await new Promise(r => setTimeout(r, 3000));
      startProgressTick(90);
      matrixSuccess = await runMatrixGeneration();
    }

    stopProgressTick();

    if (matrixSuccess) {
      updateStepStatus('matrix', 'done');
      setPipelineProgress(92);
      await finalizeOnboarding();
    } else {
      updateStepStatus('matrix', 'error');
      setPipelineProgress(75);
      setMatrixRetryAvailable(true);
    }
  };

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
          <p className="text-muted-foreground text-xs">Sem uma descrição detalhada, o estudo de público e a matriz de conteúdo não conseguem ser precisos. Descreva melhor para ter resultados incríveis!</p>
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

  if (showPipeline) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="gradient-header px-4 pt-10 pb-12 rounded-b-3xl text-center">
          <span className="font-serif text-xl font-bold text-primary">InfluLab</span>
          <p className="text-white/60 text-sm mt-1">Preparando tudo para você</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-6">
          <div className="w-full max-w-sm space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
              <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="text-5xl">✨</motion.div>
              <h2 className="font-serif text-xl font-bold">Estamos construindo algo único para você, {displayName}</h2>
              <p className="text-muted-foreground text-sm">Isso leva cerca de 1 minuto...</p>
            </motion.div>
            <div className="space-y-4">
              {pipelineSteps.map((ps, i) => {
                const Icon = ps.icon;
                return (
                  <motion.div key={ps.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-500 ${
                      ps.status === 'active' ? 'bg-primary/10 ring-1 ring-primary/30' :
                      ps.status === 'done' ? 'bg-emerald-500/10' :
                      ps.status === 'error' ? 'bg-destructive/10' : 'bg-muted/30'
                    }`}
                  >
                    <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      ps.status === 'active' ? 'bg-primary/20 text-primary' :
                      ps.status === 'done' ? 'bg-emerald-500/20 text-emerald-500' :
                      ps.status === 'error' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                    }`}>
                      {ps.status === 'active' ? <Loader2 size={16} className="animate-spin" /> : ps.status === 'done' ? <Check size={16} /> : <Icon size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${ps.status === 'done' ? 'text-emerald-500' : ps.status === 'active' ? 'text-foreground' : ps.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{ps.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ps.status === 'done' ? 'Concluído ✓' : ps.status === 'error' ? 'Erro (tentando novamente...)' : ps.sublabel}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {matrixRetryAvailable && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                <Button onClick={handleRetryMatrix} className="flex-1 gold-gradient text-primary-foreground">
                  <RefreshCw size={16} /> Tentar novamente
                </Button>
                <Button variant="outline" onClick={handleSkipMatrix} className="flex-1">
                  Pular e continuar
                </Button>
              </motion.div>
            )}

            <div className="space-y-2">
              <Progress value={pipelineProgress} className="h-2" />
              <p className="text-center text-xs text-muted-foreground">
                {pipelineProgress < 100 ? `${Math.round(pipelineProgress)}% concluído` : 'Finalizado! Redirecionando...'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="flex gap-3">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
                <ArrowLeft size={16} /> Voltar
              </Button>
            )}
            {step < 2 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canAdvance()} className="flex-1 gold-gradient text-primary-foreground shadow-md shadow-primary/20">
                Próximo <ArrowRight size={16} />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={saving} className="flex-1 gold-gradient text-primary-foreground shadow-md shadow-primary/20">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {saving ? 'Preparando...' : 'Começar Jornada'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
