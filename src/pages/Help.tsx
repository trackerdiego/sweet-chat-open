import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Coins,
  Trophy,
  Gift,
  Tag,
  CheckCircle2,
  Flame,
  Wallet as WalletIcon,
  PlayCircle,
  Mail,
  MessageCircle,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { VideoEmbed } from '@/components/landing/VideoEmbed';
import { TUTORIALS, type TutorialTopic } from '@/data/tutorials';
import { PageBackdrop } from '@/components/PageBackdrop';

const SUPPORT_EMAIL = 'suporte@vyrallab.online';
const SUPPORT_WHATSAPP = '5585987051615';
const SUPPORT_WHATSAPP_DISPLAY = '(85) 98705-1615';
const SUPPORT_WHATSAPP_MESSAGE = 'Olá! Preciso de ajuda com minha assinatura VyralLab.';
const TUTORIAL_TOPICS: TutorialTopic[] = ['onboarding', 'matriz', 'scripts', 'tools', 'tarefas'];

export default function Help() {
  const navigate = useNavigate();
  const location = useLocation();

  // Hash-driven open state for tutorials accordion (e.g. /ajuda#matriz)
  const initialHash = location.hash.replace('#', '') as TutorialTopic | '';
  const [openTutorial, setOpenTutorial] = useState<string>(
    TUTORIAL_TOPICS.includes(initialHash as TutorialTopic) ? initialHash : '',
  );
  const tutorialRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (!hash) return;
    if (TUTORIAL_TOPICS.includes(hash as TutorialTopic)) {
      setOpenTutorial(hash);
      // small delay so accordion content mounts before scroll
      const t = setTimeout(() => {
        tutorialRefs.current[hash]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
      return () => clearTimeout(t);
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen pb-24 md:pb-6 md:pt-20 relative overflow-hidden">
      <PageBackdrop />

      <div className="relative z-10 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 max-w-lg mx-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="text-foreground/70 hover:text-foreground mb-2"
          aria-label="Voltar"
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'hsl(270 95% 65% / 0.12)', border: '1px solid hsl(270 95% 65% / 0.35)' }}>
            <HelpCircle className="text-primary" size={24} />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Central de ajuda</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tire suas dúvidas e aproveite ao máximo
          </p>
        </div>
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 space-y-6">
        {/* ===================== TUTORIAIS EM VÍDEO ===================== */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <PlayCircle size={16} className="text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Tutoriais em vídeo</h2>
          </div>

          <Accordion
            type="single"
            collapsible
            value={openTutorial}
            onValueChange={setOpenTutorial}
            className="space-y-3"
          >
            {TUTORIALS.map((tut) => (
              <AccordionItem
                key={tut.topic}
                id={tut.topic}
                ref={(el) => (tutorialRefs.current[tut.topic] = el as HTMLDivElement | null)}
                value={tut.topic}
                className="app-neon-border soft border-none px-4 rounded-2xl scroll-mt-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3 text-left flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <PlayCircle size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{tut.title}</p>
                      <p className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                        <Clock size={11} /> {tut.duration}
                        {!tut.wistiaId && (
                          <span className="ml-1.5 text-[10px] uppercase tracking-wide bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                            Em produção
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-5 space-y-3 text-sm text-muted-foreground">
                  <p>{tut.description}</p>
                  {tut.wistiaId ? (
                    <VideoEmbed
                      provider="wistia"
                      videoId={tut.wistiaId}
                      title={tut.title}
                      thumbnailUrl={tut.thumbnailUrl}
                      aspect="16/9"
                    />
                  ) : (
                    <div className="aspect-video w-full rounded-2xl bg-gradient-to-br from-primary/15 via-charcoal/40 to-accent/10 ring-1 ring-white/10 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                      <PlayCircle size={32} className="text-primary/60" />
                      <p className="font-medium text-foreground/80">Vídeo em produção</p>
                      <p>Estamos finalizando a gravação. Volte em breve!</p>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <div className="space-y-4">
        <Accordion
          type="single"
          collapsible
          defaultValue="coins"
          className="space-y-3"
        >
          {/* ===================== COINS ===================== */}
          <AccordionItem
            value="coins"
            className="app-neon-border soft border-none px-4 rounded-2xl"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Coins size={18} />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Como funcionam as Coins</p>
                  <p className="text-xs text-muted-foreground font-normal">
                    Ganhe desconto na sua assinatura
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-5 space-y-5 text-sm text-muted-foreground">
              {/* O que são */}
              <section>
                <h3 className="font-semibold text-foreground mb-1">O que são coins?</h3>
                <p>
                  Coins são a moeda interna do app. Você ganha conforme usa a plataforma e elas
                  viram <strong className="text-foreground">desconto automático</strong> na sua
                  próxima fatura.
                </p>
                <p className="mt-1.5 text-xs bg-primary/5 border border-primary/15 rounded-lg px-3 py-2 text-foreground">
                  💡 1 coin = R$ 0,01
                </p>
              </section>

              {/* Como ganhar */}
              <section>
                <h3 className="font-semibold text-foreground mb-2">Como ganhar coins</h3>
                <ul className="space-y-2.5">
                  <li className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                      <CheckCircle2 size={14} />
                    </div>
                    <div>
                      <p className="text-foreground font-medium">+10 coins por tarefa</p>
                      <p className="text-xs">A cada tarefa diária concluída, você ganha 10 coins.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                      <Flame size={14} />
                    </div>
                    <div>
                      <p className="text-foreground font-medium">+50 coins por streak</p>
                      <p className="text-xs">
                        Bônus a cada 7 dias consecutivos de uso (streak de 7, 14, 21…).
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                      <Gift size={14} />
                    </div>
                    <div>
                      <p className="text-foreground font-medium">Indicações pagas</p>
                      <p className="text-xs">
                        Cada amigo que assinar pelo seu link te dá créditos em R$ direto na carteira.
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-primary text-xs mt-1"
                        onClick={() => navigate('/indique')}
                      >
                        Convidar amigos →
                      </Button>
                    </div>
                  </li>
                </ul>
              </section>

              {/* Como usar */}
              <section>
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Tag size={14} className="text-primary" /> Como vira benefício
                </h3>
                <p className="mb-2">
                  Você não precisa fazer nada — o sistema aplica automaticamente. O que você ganha
                  depende do seu plano:
                </p>
                <ul className="space-y-2 text-xs">
                  <li className="bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                    <p className="text-foreground font-medium mb-0.5">📅 Plano mensal</p>
                    <p>
                      Seus coins viram <strong className="text-foreground">desconto direto na próxima fatura</strong>.
                      O saldo é debitado e volta a acumular.
                    </p>
                  </li>
                  <li className="bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                    <p className="text-foreground font-medium mb-0.5">📆 Plano anual</p>
                    <p>
                      Seus coins viram <strong className="text-foreground">dias extras de plano</strong>.
                      A cada <strong className="text-foreground">2.475 coins acumulados</strong>, o sistema
                      adiciona <strong className="text-foreground">+30 dias</strong> ao fim da sua assinatura
                      <strong className="text-foreground"> automaticamente, todo mês</strong> — você não
                      precisa esperar a renovação.
                    </p>
                  </li>
                </ul>
              </section>

              {/* Limites */}
              <section>
                <h3 className="font-semibold text-foreground mb-2">Regras importantes</h3>
                <ul className="space-y-1.5 list-disc list-inside text-xs">
                  <li>
                    <strong className="text-foreground">Mensal:</strong> desconto máximo de 50% do
                    valor do plano (até R$ 23,50/mês).
                  </li>
                  <li>
                    <strong className="text-foreground">Anual:</strong> até +6 meses extras por
                    ciclo de 12 meses (também 50% do plano).
                  </li>
                  <li>Coins não expiram enquanto sua assinatura estiver ativa.</li>
                  <li>
                    Se o pagamento falhar, o desconto ou extensão é revertido e seus coins voltam
                    para a carteira.
                  </li>
                  <li>Coins são pessoais e não podem ser transferidos entre contas.</li>
                </ul>
              </section>

              {/* FAQ */}
              <section>
                <h3 className="font-semibold text-foreground mb-2">Perguntas frequentes</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <p className="text-foreground font-medium">Posso sacar coins em dinheiro?</p>
                    <p>Não. Coins funcionam apenas como desconto ou extensão da assinatura.</p>
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Perco meus coins se cancelar?</p>
                    <p>
                      Sim, coins ficam vinculados a uma assinatura ativa. Reativando, você volta a
                      acumular do zero.
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground font-medium">
                      Quanto tempo até virar benefício? (mensal)
                    </p>
                    <p>Aplicado automaticamente na sua próxima cobrança mensal.</p>
                  </div>
                  <div>
                    <p className="text-foreground font-medium">
                      Quanto tempo até virar benefício? (anual)
                    </p>
                    <p>
                      Sempre que você bater 2.475 coins acumulados, +30 dias são adicionados ao fim
                      da sua assinatura. O restante do saldo segue acumulando.
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Onde vejo meu saldo?</p>
                    <p>Na página da Carteira, com histórico completo de movimentações.</p>
                  </div>
                </div>
              </section>


              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => navigate('/carteira')}
              >
                <WalletIcon size={16} /> Abrir minha carteira
              </Button>
            </AccordionContent>
          </AccordionItem>


          {/* ===================== SUPORTE ===================== */}
          <AccordionItem
            value="suporte"
            className="app-neon-border soft border-none px-4 rounded-2xl"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Suporte e contato</p>
                  <p className="text-xs text-muted-foreground font-normal">
                    Fale com a gente diretamente
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm text-muted-foreground space-y-3">
              <p>
                Pra dúvidas sobre <strong className="text-foreground">assinatura, pagamento ou acesso</strong>,
                fala com a gente direto no WhatsApp — resposta rápida em horário comercial.
                Pra registro formal ou anexar prints, use o email (até 24h em dias úteis).
              </p>
              <Button
                className="w-full gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white border-0"
                onClick={() =>
                  window.open(
                    `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(SUPPORT_WHATSAPP_MESSAGE)}`,
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              >
                <MessageCircle size={16} /> WhatsApp {SUPPORT_WHATSAPP_DISPLAY}
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => (window.location.href = `mailto:${SUPPORT_EMAIL}`)}
              >
                <Mail size={16} /> {SUPPORT_EMAIL}
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center text-xs text-muted-foreground/70 pt-2 flex items-center justify-center gap-1.5"
        >
          <Trophy size={12} /> Quanto mais você usa, mais economiza.
        </motion.div>
      </div>
    </div>
  );
}
