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
import { ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

const contentStyles = [
  { id: 'casual', label: 'Casual', description: 'Leve e descontraído, como conversa entre amigos', emoji: '😊' },
  { id: 'profissional', label: 'Profissional', description: 'Autoritário e informativo, com dados e dicas', emoji: '📊' },
  { id: 'divertido', label: 'Divertido', description: 'Engraçado e irreverente, com memes e trends', emoji: '🎉' },
];

/**
 * Dispara a personalização em background sem aguardar resposta.
 * O frontend não trava: o usuário entra no app imediatamente e a matriz
 * personalizada é trocada quando ficar pronta (ver useUserStrategies).
 *
 * Usa keepalive: true via fetch direto para garantir que a request não seja
 * cancelada quando a página navegar.
 */
async function fireAndForgetPersonalization(payload: {
  primaryNiche: string;
  secondaryNiches: string[];
  contentStyle: string;
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const SUPABASE_URL = "https://api.influlab.pro";
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': (supabase as any).supabaseKey || '',
    };

    // Step 1: descrição → quando terminar, dispara avatar → quando terminar, dispara matriz.
    // Encadeamento feito do lado do cliente, mas SEM bloquear a UI: cada chamada é
    // disparada com keepalive e o frontend não aguarda.
    const runChain = async () => {
      try {
        // 1. descrição
        const r1 = await fetch(`${SUPABASE_URL}/functions/v1/generate-audience-profile`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...payload, step: 'description' }),
          keepalive: true,
        });
        if (!r1.ok) { console.warn('[bg] description failed', r1.status); return; }

        // 2. avatar
        const r2 = await fetch(`${SUPABASE_URL}/functions/v1/generate-audience-profile`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...payload, step: 'avatar' }),
          keepalive: true,
        });
        if (!r2.ok) { console.warn('[bg] avatar failed', r2.status); return; }

        // 3. matriz personalizada
        const r3 = await fetch(`${SUPABASE_URL}/functions/v1/generate-personalized-matrix`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          keepalive: true,
        });
        if (!r3.ok) { console.warn('[bg] matrix failed', r3.status); return; }

        console.log('[bg] personalization chain complete');
      } catch (e) {
        console.warn('[bg] chain error', e);
      }
    };

    // Não awaita: deixa rodar em background.
    runChain();
  } catch (e) {
    console.warn('[bg] failed to start personalization', e);
  }
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

  const canAdvance = () => {
    if (step === 0) return displayName.trim().length >= 2;
    if (step === 1) return businessDescription.trim().length >= 80;
    if (step === 2) return !!contentStyle;
    return false;
  };

  const handleFinish = async () => {
    setSaving(true);

    const payload = {
      display_name: displayName.trim(),
      primary_niche: businessDescription.trim(),
      secondary_niches: [] as string[],
      content_style: contentStyle,
      onboarding_completed: true,
      description_status: 'ok' as const,
    };

    // 1. Salva o perfil COMPLETO já marcando onboarding_completed=true.
    // Sem espera por IA: o usuário não pode mais ficar travado em tela vermelha.
    let result = await updateProfile(payload);

    if (result?.error) {
      await new Promise(r => setTimeout(r, 800));
      result = await updateProfile(payload);
    }

    if (result?.error) {
      // Fallback: upsert direto
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

    // 2. Dispara personalização em background (não aguarda).
    fireAndForgetPersonalization({
      primaryNiche: businessDescription.trim(),
      secondaryNiches: [],
      contentStyle,
    });

    // 3. Redireciona imediatamente. O dashboard mostra a matriz base e troca
    //    automaticamente quando a personalizada chegar (polling no useUserStrategies).
    toast.success('Tudo pronto! Personalizando sua experiência em segundo plano...');
    await new Promise(r => setTimeout(r, 400));
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
          <p className="text-center text-xs text-muted-foreground px-4">
            Sua matriz personalizada é gerada em segundo plano. Você já entra no app e ela aparece automaticamente quando estiver pronta (~2 min).
          </p>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
