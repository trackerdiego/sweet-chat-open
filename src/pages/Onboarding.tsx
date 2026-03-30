import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Loader2, Sparkles, Check, Users, Brain, Calendar } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

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

const Onboarding = () => {
  const { updateProfile, profile } = useUserProfile();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [businessDescription, setBusinessDescription] = useState(profile?.primary_niche || '');
  const [contentStyle, setContentStyle] = useState(profile?.content_style || 'casual');
  const [saving, setSaving] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([
    { id: 'audience', label: 'Gerando descrição do seu público ideal', sublabel: 'Analisando seu perfil...', icon: Users, status: 'pending' },
    { id: 'visceral', label: 'Realizando estudo visceral do seu público', sublabel: 'Mapeando psicologia, medos, desejos...', icon: Brain, status: 'pending' },
    { id: 'matrix', label: 'Criando sua Matriz personalizada', sublabel: 'Construindo 30 dias de estratégias...', icon: Calendar, status: 'pending' },
  ]);

  const canAdvance = () => {
    if (step === 0) return displayName.trim().length >= 2;
    if (step === 1) return businessDescription.trim().length >= 30;
    if (step === 2) return !!contentStyle;
    return false;
  };

  const updateStepStatus = (stepId: string, status: PipelineStep['status']) => {
    setPipelineSteps(prev => prev.map(s => s.id === stepId ? { ...s, status } : s));
  };

  const handleFinish = async () => {
    setSaving(true);

    // Try updateProfile, retry once, then fallback to direct upsert
    let result = await updateProfile({
      display_name: displayName.trim(),
      primary_niche: businessDescription.trim(),
      secondary_niches: [],
      content_style: contentStyle,
    });

    if (result?.error) {
      // Retry once
      await new Promise(r => setTimeout(r, 1000));
      result = await updateProfile({
        display_name: displayName.trim(),
        primary_niche: businessDescription.trim(),
        secondary_niches: [],
        content_style: contentStyle,
      });
    }

    if (result?.error) {
      // Direct upsert fallback
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
    setPipelineProgress(5);

    try {
      updateStepStatus('audience', 'active');
      setPipelineProgress(10);

      const { error: audienceError } = await supabase.functions.invoke('generate-audience-profile', {
        body: { primaryNiche: businessDescription.trim(), secondaryNiches: [], contentStyle },
      });

      if (audienceError) {
        updateStepStatus('audience', 'error');
        updateStepStatus('visceral', 'error');
      } else {
        updateStepStatus('audience', 'done');
        setPipelineProgress(35);
        updateStepStatus('visceral', 'done');
        setPipelineProgress(55);
      }

      updateStepStatus('matrix', 'active');
      setPipelineProgress(60);

      const { error: matrixError } = await supabase.functions.invoke('generate-personalized-matrix', {
        body: { primaryNiche: businessDescription.trim(), secondaryNiches: [], contentStyle },
      });

      if (matrixError) {
        updateStepStatus('matrix', 'error');
        toast.warning('A matriz será gerada em breve. Você já pode explorar o app!');
      } else {
        updateStepStatus('matrix', 'done');
        setPipelineProgress(95);
      }

      setPipelineProgress(100);
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      toast.warning('Houve um erro parcial, mas você já pode usar o app!');
    }

    const completeResult = await updateProfile({ onboarding_completed: true });
    if (completeResult?.error) {
      const retry = await updateProfile({ onboarding_completed: true });
      if (retry?.error) {
        toast.error('Erro ao finalizar. Tente novamente.');
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    window.location.replace('/');
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

    <motion.div key="description" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="space-y-6">
      <div className="text-center space-y-2">
        <span className="text-4xl">🎯</span>
        <h2 className="font-serif text-2xl font-bold">Conte sobre seu conteúdo</h2>
        <p className="text-muted-foreground text-sm">Descreva o que você faz, para quem cria conteúdo e o que quer alcançar</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Sua descrição</Label>
        <Textarea
          id="description"
          value={businessDescription}
          onChange={e => setBusinessDescription(e.target.value)}
          placeholder="Ex: Sou personal trainer focado em pessoas acima de 40 que querem emagrecer sem academia."
          className="min-h-[120px] text-sm"
          autoFocus
        />
        <p className={`text-xs ${businessDescription.trim().length >= 30 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          {businessDescription.trim().length}/30 caracteres mínimos
        </p>
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
                      <p className={`text-sm font-medium ${ps.status === 'done' ? 'text-emerald-500' : ps.status === 'active' ? 'text-foreground' : 'text-muted-foreground'}`}>{ps.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ps.status === 'done' ? 'Concluído ✓' : ps.status === 'error' ? 'Erro (continuando...)' : ps.sublabel}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
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
