import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useUserUsage } from '@/hooks/useUserUsage';
import { CheckoutModal } from '@/components/CheckoutModal';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const suggestions = [
  'Que tipo de conteúdo meu público mais engaja?',
  'Me dê 5 ideias de Reels para essa semana',
  'Qual a maior objeção do meu público e como quebrá-la?',
  'Crie 3 hooks impossíveis de ignorar para meu nicho',
];

async function streamChat({ messages, onDelta, onDone, onError }: { messages: Msg[]; onDelta: (text: string) => void; onDone: () => void; onError: (err: string) => void; }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) { onError('Você precisa estar logado'); return; }

  const doFetch = async (token: string) => {
    return fetch(CHAT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ messages }) });
  };

  let resp = await doFetch(session.access_token).catch(() => null);

  // Retry once: refresh token and try again
  if (!resp || !resp.ok) {
    if (!resp || resp.status === 401 || resp.status >= 500) {
      const { data: { session: refreshed } } = await supabase.auth.refreshSession();
      if (refreshed?.access_token) {
        resp = await doFetch(refreshed.access_token).catch(() => null);
      }
    }
  }

  if (!resp) { onError('Erro de conexão com a IA'); return; }
  if (!resp.ok) { const data = await resp.json().catch(() => ({})); onError(data.error || 'Erro ao conectar com a IA'); return; }
  if (!resp.body) { onError('Sem resposta da IA'); return; }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamDone = false;
  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') { streamDone = true; break; }
      try { const parsed = JSON.parse(json); const content = parsed.choices?.[0]?.delta?.content; if (content) onDelta(content); } catch { buffer = line + '\n' + buffer; break; }
    }
  }
  onDone();
}

export function AiChat() {
  const { isPremium } = useUserUsage();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]); setInput(''); setIsLoading(true);
    let assistantSoFar = '';
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => { const last = prev[prev.length - 1]; if (last?.role === 'assistant') { return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m); } return [...prev, { role: 'assistant', content: assistantSoFar }]; });
    };
    try {
      await streamChat({ messages: [...messages, userMsg], onDelta: upsert, onDone: () => setIsLoading(false), onError: (err) => { setIsLoading(false); if (err.includes('limite') || err.includes('10 mensagens')) { setCheckoutOpen(true); } toast.error(err); } });
    } catch { setIsLoading(false); toast.error('Erro de conexão.'); }
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } };

  return (
    <div className="flex flex-col h-full">
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-8">
            <div className="text-center space-y-2">
              <div className="flex justify-center"><div className="p-3 rounded-xl bg-primary/10"><Bot size={28} className="text-primary" /></div></div>
              <h3 className="font-serif text-lg font-semibold">Consultor IA</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">Pergunte qualquer coisa sobre estratégia de conteúdo.</p>
              {!isPremium && <Badge variant="outline" className="text-[10px]">10 mensagens no plano gratuito</Badge>}
            </div>
            <div className="space-y-2">
              {suggestions.map((s) => (<button key={s} onClick={() => send(s)} className="w-full text-left glass-card p-3 text-sm hover:shadow-md transition-shadow"><span className="text-primary mr-1.5">💡</span> {s}</button>))}
            </div>
          </motion.div>
        )}
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5"><Sparkles size={14} className="text-primary" /></div>}
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'glass-card rounded-bl-md'}`}>
                {msg.role === 'assistant' ? <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div> : <p>{msg.content}</p>}
              </div>
              {msg.role === 'user' && <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center mt-0.5"><User size={14} /></div>}
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-2.5"><div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center"><Sparkles size={14} className="text-primary" /></div><div className="glass-card rounded-2xl rounded-bl-md px-4 py-3"><Loader2 size={16} className="animate-spin text-primary" /></div></div>
        )}
      </div>
      <div className="shrink-0 flex gap-2 items-end pt-2 border-t border-border">
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Pergunte algo sobre seu conteúdo..." className="min-h-[44px] max-h-[100px] resize-none text-base" rows={1} disabled={isLoading} />
        <Button onClick={() => send(input)} disabled={!input.trim() || isLoading} size="icon" className="shrink-0 h-[44px] w-[44px] gold-gradient text-primary-foreground">
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </Button>
      </div>
    </div>
  );
}
