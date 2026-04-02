import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Search, Scissors, RefreshCw, Sparkles, Loader2, Copy, Check, ArrowLeft, Upload, FileAudio, FileVideo, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserUsage } from '@/hooks/useUserUsage';
import { CheckoutModal } from '@/components/CheckoutModal';
import { toast } from 'sonner';
import { AiChat } from '@/components/AiChat';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

type ToolType = 'dissonance' | 'patterns' | 'hooks' | 'viral' | 'chat';

interface ToolConfig {
  id: ToolType;
  icon: typeof Zap;
  title: string;
  description: string;
  needsInput: boolean;
  inputPlaceholder?: string;
  inputLabel?: string;
}

const tools: ToolConfig[] = [
  { id: 'chat', icon: MessageSquare, title: 'Consultor IA', description: 'Chat estratégico que já conhece seu público', needsInput: false },
  { id: 'dissonance', icon: Zap, title: 'Ganchos de Dissonância', description: 'Gere headlines impossíveis de ignorar', needsInput: false },
  { id: 'patterns', icon: Search, title: 'Extração de Padrões', description: 'Descubra os frameworks ocultos de copies', needsInput: true, inputPlaceholder: 'Cole aqui 3-5 anúncios ou copies...', inputLabel: 'Anúncios/Copies de referência' },
  { id: 'hooks', icon: Scissors, title: 'Desconstrução de Hooks', description: 'Descubra por que hooks virais funcionam', needsInput: true, inputPlaceholder: 'Cole hooks ou headlines virais...', inputLabel: 'Hooks/Headlines para desconstruir' },
  { id: 'viral', icon: RefreshCw, title: 'Adaptação de Virais', description: 'Receba um roteiro adaptado ao seu nicho', needsInput: true, inputPlaceholder: 'Cole a transcrição do vídeo viral...', inputLabel: 'Transcrição do vídeo viral' },
];

function ToolCard({ tool, onClick }: { tool: ToolConfig; onClick: () => void }) {
  const Icon = tool.icon;
  return (
    <motion.button initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} whileTap={{ scale: 0.97 }} onClick={onClick} className="w-full glass-card p-5 text-left hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-primary/10 shrink-0"><Icon size={22} className="text-primary" /></div>
        <div className="space-y-1.5">
          <h3 className="font-serif font-semibold text-base">{tool.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{tool.description}</p>
        </div>
      </div>
    </motion.button>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ResultRenderer({ toolType, data }: { toolType: ToolType; data: any }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  if (toolType === 'dissonance' && data.hooks) {
    return (
      <div className="space-y-3">
        {data.hooks.map((h: { hook: string; whyItWorks: string; emotionalTrigger: string }, i: number) => (
          <div key={i} className="glass-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm">"{h.hook}"</p>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyText(h.hook, i)}>
                {copiedIdx === i ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">💡 {h.whyItWorks}</p>
            <Badge variant="outline" className="text-[10px]">🎯 {h.emotionalTrigger}</Badge>
          </div>
        ))}
      </div>
    );
  }

  if (toolType === 'patterns' && data.patterns) {
    return (
      <div className="space-y-3">
        {data.patterns.map((p: { framework: string; emotionalTriggers: string; adaptation: string; example: string }, i: number) => (
          <div key={i} className="glass-card p-4 space-y-2">
            <h4 className="font-semibold text-sm">🔧 {p.framework}</h4>
            <p className="text-xs text-muted-foreground">🎯 Gatilhos: {p.emotionalTriggers}</p>
            <p className="text-xs text-muted-foreground">🔄 Adaptação: {p.adaptation}</p>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium">📝 Exemplo: {p.example}</p>
                <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => copyText(p.example, i)}>
                  {copiedIdx === i ? <Check size={12} /> : <Copy size={12} />}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (toolType === 'hooks' && data.analyses) {
    return (
      <div className="space-y-3">
        {data.analyses.map((a: { originalHook: string; emotionalTrigger: string; technique: string; variations: string[] }, i: number) => (
          <div key={i} className="glass-card p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Original: "{a.originalHook}"</p>
            <p className="text-xs">🎯 Gatilho: <span className="font-medium">{a.emotionalTrigger}</span></p>
            <p className="text-xs">🔧 Técnica: <span className="font-medium">{a.technique}</span></p>
            <div className="space-y-1.5 mt-2">
              <p className="text-xs font-semibold">Variações para seu nicho:</p>
              {a.variations.map((v: string, vi: number) => (
                <div key={vi} className="flex items-start justify-between gap-2 bg-muted/50 rounded-lg p-2">
                  <p className="text-xs">"{v}"</p>
                  <Button variant="ghost" size="icon" className="shrink-0 h-6 w-6" onClick={() => copyText(v, i * 10 + vi)}>
                    {copiedIdx === i * 10 + vi ? <Check size={10} /> : <Copy size={10} />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (toolType === 'viral' && data.adaptedScript) {
    return (
      <div className="space-y-3">
        <div className="glass-card p-4 space-y-2">
          <h4 className="font-semibold text-sm">📊 Análise da Estrutura</h4>
          <p className="text-xs text-muted-foreground">{data.structureAnalysis}</p>
        </div>
        <div className="glass-card p-4 space-y-3">
          <h4 className="font-semibold text-sm">🎬 Script Adaptado</h4>
          <div className="space-y-2">
            <div className="bg-primary/5 rounded-lg p-3">
              <p className="text-xs font-semibold text-primary mb-1">Hook (0-3s):</p>
              <p className="text-sm">{data.adaptedScript.hook}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-semibold mb-1">Corpo:</p>
              <p className="text-sm">{data.adaptedScript.body}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-semibold mb-1">CTA:</p>
              <p className="text-sm">{data.adaptedScript.cta}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => copyText(`🎬 HOOK:\n${data.adaptedScript.hook}\n\n📖 CORPO:\n${data.adaptedScript.body}\n\n🎯 CTA:\n${data.adaptedScript.cta}`, 99)}>
            {copiedIdx === 99 ? <Check size={14} /> : <Copy size={14} />}
            {copiedIdx === 99 ? 'Copiado!' : 'Copiar Script'}
          </Button>
        </div>
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">Resultado recebido.</p>;
}

const ACCEPTED_MEDIA_TYPES = '.mp4,.mov,.webm,.mp3,.m4a,.wav,.ogg';
const MAX_FILE_SIZE_MB = 200;
const isVideoFile = (type: string) => type.startsWith('video/');

let ffmpegInstance: FFmpeg | null = null;
const getFFmpeg = async () => {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
};

type ProcessingStep = 'idle' | 'extracting' | 'uploading' | 'transcribing';
const stepLabels: Record<ProcessingStep, string> = {
  idle: '',
  extracting: 'Extraindo áudio do vídeo...',
  uploading: 'Enviando áudio...',
  transcribing: 'Transcrevendo com IA...',
};

const Tools = () => {
  const { profile } = useUserProfile();
  const { canUseTool, canTranscribe, remainingTools, remainingTranscriptions, incrementUsage, isPremium } = useUserUsage();
  const [selectedTool, setSelectedTool] = useState<ToolConfig | null>(null);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const extractAudio = useCallback(async (file: File): Promise<{ blob: Blob; name: string }> => {
    const ffmpeg = await getFFmpeg();
    const inputName = 'input' + file.name.substring(file.name.lastIndexOf('.'));
    const outputName = 'output.mp3';
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec(['-i', inputName, '-vn', '-acodec', 'libmp3lame', '-q:a', '4', outputName]);
    const data = await ffmpeg.readFile(outputName);
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
    const blob = new Blob([data as BlobPart], { type: 'audio/mp3' });
    return { blob, name: file.name.replace(/\.[^.]+$/, '.mp3') };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) { toast.error(`Arquivo muito grande (${sizeMB.toFixed(1)}MB).`); return; }
    if (!canTranscribe) { toast.error('Limite de transcrições atingido.'); setCheckoutOpen(true); return; }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Você precisa estar logada.'); return; }
      let uploadBlob: Blob = file;
      let uploadName = file.name;
      let mimeType = file.type;

      if (isVideoFile(file.type)) {
        setProcessingStep('extracting');
        const extracted = await extractAudio(file);
        uploadBlob = extracted.blob;
        uploadName = extracted.name;
        mimeType = 'audio/mp3';
      }

      setProcessingStep('uploading');
      const filePath = `${user.id}/${Date.now()}-${uploadName}`;
      const { error: uploadError } = await supabase.storage.from('media-uploads').upload(filePath, uploadBlob);
      if (uploadError) throw uploadError;

      setProcessingStep('transcribing');
      const { data, error } = await supabase.functions.invoke('transcribe-media', { body: { filePath, mimeType } });
      if (error) throw error;
      if (data?.transcription) {
        setUserInput(prev => prev ? `${prev}\n\n${data.transcription}` : data.transcription);
        toast.success('Transcrição concluída! ✨');
        await incrementUsage('transcriptions');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      toast.error('Erro ao transcrever.');
    } finally {
      setProcessingStep('idle');
    }
  };

  const handleGenerate = async () => {
    if (!selectedTool) return;
    if (selectedTool.needsInput && !userInput.trim()) { toast.error('Cole o conteúdo antes de gerar.'); return; }
    if (!canUseTool) { toast.error('Limite de gerações atingido.'); setCheckoutOpen(true); return; }

    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-tools-content', {
        body: { toolType: selectedTool.id, userInput: userInput.trim(), primaryNiche: profile?.primary_niche || '', contentStyle: profile?.content_style || 'casual' },
      });
      if (error) throw error;
      setResult(data);
      toast.success('Conteúdo gerado! ✨');
      await incrementUsage('tool_generations');
    } catch (err) {
      console.error('Tool generation error:', err);
      toast.error('Erro ao gerar.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => { setSelectedTool(null); setUserInput(''); setResult(null); };

  return (
    <div className={`${selectedTool?.id === 'chat' ? 'h-[100dvh] flex flex-col md:pt-20 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]' : 'min-h-screen pb-24 md:pt-20 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]'} max-w-lg mx-auto`}>
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
      <AnimatePresence mode="wait">
        {!selectedTool ? (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="text-center space-y-2 mb-6">
              <h1 className="font-serif text-2xl font-bold">Ferramentas IA</h1>
              <p className="text-muted-foreground text-sm">Ferramentas avançadas alimentadas pelo seu estudo visceral</p>
            </div>
            {tools.map((tool, i) => (
              <motion.div key={tool.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08 }}>
                <ToolCard tool={tool} onClick={() => setSelectedTool(tool)} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div key="detail" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} className="space-y-4">
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
              <ArrowLeft size={16} /> Voltar
            </Button>

            {selectedTool.id === 'chat' ? (
              <AiChat />
            ) : (
            <>
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="p-3 rounded-xl bg-primary/10">
                  <selectedTool.icon size={28} className="text-primary" />
                </div>
              </div>
              <h2 className="font-serif text-xl font-bold">{selectedTool.title}</h2>
              <p className="text-muted-foreground text-sm">{selectedTool.description}</p>
            </div>

            {selectedTool.needsInput && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{selectedTool.inputLabel}</label>
                <Textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder={selectedTool.inputPlaceholder} className="min-h-[150px]" disabled={processingStep !== 'idle'} />
                <input ref={fileInputRef} type="file" accept={ACCEPTED_MEDIA_TYPES} onChange={handleFileUpload} className="hidden" />
                {processingStep !== 'idle' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-primary font-medium">
                      <Loader2 size={14} className="animate-spin" />
                      {stepLabels[processingStep]}
                    </div>
                    <Progress value={processingStep === 'extracting' ? 33 : processingStep === 'uploading' ? 66 : 90} className="h-1.5" />
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => fileInputRef.current?.click()} disabled={processingStep !== 'idle'}>
                  <Upload size={14} /> Enviar vídeo ou áudio para transcrever
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">MP4, MOV, WebM, MP3, M4A, WAV, OGG — até {MAX_FILE_SIZE_MB}MB</p>
              </div>
            )}

            <Button onClick={handleGenerate} disabled={loading} className="w-full gold-gradient text-primary-foreground" size="lg">
              {loading ? (<><Loader2 size={18} className="animate-spin" /> Gerando com IA...</>) : (<><Sparkles size={18} /> {result ? 'Regenerar' : `Gerar com IA${!isPremium ? ` (${remainingTools}/3)` : ''}`}</>)}
            </Button>

            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass-card p-4 space-y-2 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                ))}
              </div>
            )}

            {result && !loading && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                <Badge className="mb-3 bg-gradient-to-r from-primary to-accent text-primary-foreground border-0">
                  <Sparkles size={12} className="mr-1" /> Gerado por IA
                </Badge>
                <ResultRenderer toolType={selectedTool.id} data={result} />
              </motion.div>
            )}
            </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tools;
