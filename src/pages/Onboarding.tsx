import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Loader2, Sparkles, Check, X, Users, Brain, LayoutGrid } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

const contentStyles = [
  { id: 'casual', label: 'Casual', description: 'Leve e descontraído, como conversa entre amigos', emoji: '😊' },
  { id: 'profissional', label: 'Profissional', description: 'Autoritário e informativo, com dados e dicas', emoji: '📊' },
  { id: 'divertido', label: 'Divertido', description: 'Engraçado e irreverente, com memes e trends', emoji: '🎉' },
];

type PipelineStage = 'audience' | 'visceral' | 'matrix';
type StageStatus = 'pending' | 'running' | 'done' | 'error';

interface StageState {
  status: StageStatus;
  attempts: number;
}

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

  // Pipeline state
  const [showPipeline, setShowPipeline] = useState(false);
  const [stages, setStages] = useState<Record<PipelineStage, StageState>>({
    audience: { status: 'pending', attempts: 0 },
    visceral: { status: 'pending', attempts: 0 },
    matrix: { status: 'pending', attempts: 0 },
  });
  const payloadRef = useRef<{ primaryNiche: string; secondaryNiches: string[]; contentStyle: string } | null>(null);

  const canAdvance = () => {
    if (step === 0) return displayName.trim().length >= 2;
    if (step === 1) return businessDescription.trim().length >= 80;
    if (step === 2) return !!contentStyle;
    return false;
  };

  const updateStage = (stage: PipelineStage, patch: Partial<StageState>) => {
    setStages(prev => ({ ...prev, [stage]: { ...prev[stage], ...patch } }));
  };

  const runStage = async (stage: PipelineStage): Promise<boolean> => {
    if (!payloadRef.current) return false;
    updateStage(stage, { status: 'running', attempts: stages[stage].attempts + 1 });

    try {
      if (stage === 'audience') {
        const { error } = await supabase.functions.invoke('generate-audience-profile', {
          body: { ...payloadRef.current, step: 'description' },
        });
        if (error) throw error;
      } else if (stage === 'visceral') {
        const { error } = await supabase.functions.invoke('generate-audience-profile', {
          body: { ...payloadRef.current, step: 'avatar' },
        });
        if (error) throw error;
      } else if (stage === 'matrix') {
        const { error } = await supabase.functions.invoke('generate-personalized-matrix', {
          body: payloadRef.current,
        });
        if (error) throw error;
      }
      updateStage(stage, { status: 'done' });
      return true;
    } catch (e: any) {
      console.error(`[onboarding] stage ${stage} failed`, e);
      // Mensagem contextual baseada no tipo/código do erro
      const status = e?.context?.status ?? e?.status;
      const rawMsg = String(e?.message ?? e?.context?.statusText ?? '').toLowerCase();
      let userMsg = 'Não conseguimos completar essa etapa. Tente novamente.';
      if (status === 429 || rawMsg.includes('rate') || rawMsg.includes('429')) {
        userMsg = 'Muitas requisições. Aguarde 1 minuto antes de tentar de novo.';
      } else if (status === 402) {
        userMsg = 'Créditos de IA esgotados. Avise o suporte.';
      } else if (status === 503 || rawMsg.includes('unavailable') || rawMsg.includes('503')) {
        userMsg = 'Serviço de IA instável agora. Aguarde 30s e tente novamente.';
      } else if (rawMsg.includes('timeout') || rawMsg.includes('aborted') || rawMsg.includes('failed to fetch') || rawMsg.includes('network')) {
        userMsg = 'A IA está sobrecarregada agora. Aguarde 30s e tente novamente.';
      }
      toast.error(userMsg);
      updateStage(stage, { status: 'error' });
      return false;
    }
  };

  const markOnboardingCompleted = async () => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;
      await (supabase.from as any)('user_profiles')
        .update({ onboarding_completed: true })
        .eq('user_id', userId);
    } catch (e) {
      console.error('[onboarding] failed to mark completed', e);
    }
  };

  const runPipeline = async (startFrom: PipelineStage = 'audience') => {
    const order: PipelineStage[] = ['audience', 'visceral', 'matrix'];
    const startIdx = order.indexOf(startFrom);

    for (let i = startIdx; i < order.length; i++) {
      const s = order[i];
      // Skip if already done
      if (stages[s].status === 'done') continue;
      const ok = await runStage(s);
      if (!ok) return; // stop on error; user can retry
    }

    // All done — only now mark onboarding as completed
    await markOnboardingCompleted();
    toast.success('✨ Tudo pronto! Sua experiência personalizada está montada.');
    setTimeout(() => window.location.replace('/'), 1000);
  };

  const handleFinish = async () => {
    setSaving(true);

    // IMPORTANT: do NOT mark onboarding_completed=true here. We only mark it
    // after the 3-stage pipeline finishes successfully (or after the user
    // consciously chooses "Continue anyway"). Otherwise a closed tab leaves
    // the user stuck with flag=true but no personalized matrix.
    const payload = {
      display_name: displayName.trim(),
      primary_niche: businessDescription.trim(),
      secondary_niches: [] as string[],
      content_style: contentStyle,
      description_status: 'ok' as const,
    };

    let result = await updateProfile(payload);
    if (result?.error) {
      await new Promise(r => setTimeout(r, 800));
      result = await updateProfile(payload);
    }

    if (result?.error) {
      try {
        const { error: directError } = await (supabase.from as any)('user_profiles')
          .upsert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            ...payload,
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

    payloadRef.current = {
      primaryNiche: businessDescription.trim(),
      secondaryNiches: [],
      contentStyle,
    };

    // Detect already-completed stages (resume case)
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      const [{ data: aud }, { data: strat }] = await Promise.all([
        (supabase.from as any)('audience_profiles').select('audience_description, avatar_profile').eq('user_id', userId).maybeSingle(),
        (supabase.from as any)('user_strategies').select('strategies').eq('user_id', userId).maybeSingle(),
      ]);
      const hasDescription = !!aud?.audience_description;
      const hasAvatar = !!aud?.avatar_profile;
      const hasMatrix = !!strat?.strategies;

      setStages({
        audience: { status: hasDescription ? 'done' : 'pending', attempts: 0 },
        visceral: { status: hasAvatar ? 'done' : 'pending', attempts: 0 },
        matrix: { status: hasMatrix ? 'done' : 'pending', attempts: 0 },
      });
    }

    setShowPipeline(true);
    setSaving(false);
  };

  // Auto-run pipeline once shown
  useEffect(() => {
    if (!showPipeline) return;
    // Find first non-done stage
    const order: PipelineStage[] = ['audience', 'visceral', 'matrix'];
    const next = order.find(s => stages[s].status === 'pending');
    if (next && stages[next].status === 'pending' && stages.audience.status !== 'running' && stages.visceral.status !== 'running' && stages.matrix.status !== 'running') {
      runPipeline(next);
    } else if (!next && order.every(s => stages[s].status === 'done')) {
      // All done from resume — mark completed then redirect
      (async () => {
        await markOnboardingCompleted();
        toast.success('✨ Tudo pronto!');
        setTimeout(() => window.location.replace('/'), 800);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPipeline]);

  const retryStage = (stage: PipelineStage) => {
    updateStage(stage, { status: 'pending' });
    setTimeout(() => runPipeline(stage), 100);
  };

  const skipPipeline = async () => {
    await markOnboardingCompleted();
    toast.message('Você poderá personalizar depois nas configurações.');
    window.location.replace('/');
  };

  const stageMeta: Record<PipelineStage, { title: string; description: string; icon: typeof Users }> = {
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

  // ===== Pipeline screen =====
  if (showPipeline) {
    const order: PipelineStage[] = ['audience', 'visceral', 'matrix'];
    const allDone = order.every(s => stages[s].status === 'done');
    const anyError = order.some(s => stages[s].status === 'error');
    const erroredStage = order.find(s => stages[s].status === 'error');
    const stuckOnError = anyError && erroredStage && stages[erroredStage].attempts >= 2;

    return (
      <div className="min-h-screen flex flex-col">
        <div className="gradient-header px-4 pt-10 pb-12 rounded-b-3xl text-center">
          <span className="font-serif text-xl font-bold text-primary">InfluLab</span>
          <p className="text-white/60 text-sm mt-1">Personalizando sua experiência</p>
        </div>
        <div className="flex-1 flex flex-col items-center px-4 -mt-6 pb-10">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center space-y-2">
              <span className="text-4xl">{allDone ? '✨' : '⏳'}</span>
              <h2 className="font-serif text-2xl font-bold">
                {allDone ? 'Tudo pronto!' : 'Quase lá, {displayName}'.replace('{displayName}', displayName.split(' ')[0])}
              </h2>
              <p className="text-muted-foreground text-sm">
                {allDone
                  ? 'Redirecionando para o app…'
                  : 'Cada etapa leva 30-90s. Não feche a aba.'}
              </p>
            </div>

            <div className="space-y-3">
              {order.map((s, idx) => {
                const meta = stageMeta[s];
                const state = stages[s];
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={s}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className={`glass-card p-4 flex items-start gap-3 transition-all ${
                      state.status === 'running' ? 'ring-2 ring-primary/50 bg-primary/5' :
                      state.status === 'done' ? 'opacity-90' :
                      state.status === 'error' ? 'ring-2 ring-destructive/50 bg-destructive/5' :
                      'opacity-60'
                    }`}
                  >
                    <div className={`shrink-0 size-10 rounded-xl flex items-center justify-center ${
                      state.status === 'done' ? 'bg-emerald-500/15 text-emerald-500' :
                      state.status === 'error' ? 'bg-destructive/15 text-destructive' :
                      state.status === 'running' ? 'gold-gradient text-primary-foreground' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {state.status === 'done' ? <Check size={20} /> :
                       state.status === 'error' ? <X size={20} /> :
                       state.status === 'running' ? <Loader2 size={20} className="animate-spin" /> :
                       <Icon size={20} />}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium text-sm">{meta.title}</p>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                      {state.status === 'error' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryStage(s)}
                          className="mt-2 h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                        >
                          Tentar novamente
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {stuckOnError && (
              <div className="space-y-3">
                <p className="text-xs text-center text-muted-foreground">
                  Está difícil personalizar agora. Você pode entrar no app com a matriz base e tentar de novo depois.
                </p>
                <Button onClick={skipPipeline} variant="outline" className="w-full">
                  Continuar mesmo assim
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== Onboarding form steps =====
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
              <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1" disabled={saving}>
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
                {saving ? 'Salvando...' : 'Começar Jornada'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
