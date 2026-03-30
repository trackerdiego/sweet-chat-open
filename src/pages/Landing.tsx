import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sparkles,
  Calendar,
  FileText,
  Wrench,
  Mic,
  Target,
  Zap,
  CheckCircle2,
  ArrowRight,
  Crown,
  Star,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LandingFeatureBar } from "@/components/landing/FeatureBar";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { toast } from "sonner";

function Section({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
      animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

const painPoints = [
  {
    icon: "😩",
    title: "Posta todo dia e ninguém engaja",
    description: "Você cria conteúdo, segue tendências, mas o algoritmo parece te ignorar.",
  },
  {
    icon: "🤯",
    title: "Não sabe o que postar amanhã",
    description: "Aquela sensação de abrir o celular e não ter a menor ideia do que criar.",
  },
  {
    icon: "😔",
    title: "Vê outros crescendo e você parado(a)",
    description: "Outros criadores com menos talento crescem rápido.",
  },
  {
    icon: "🔥",
    title: "Burnout de criar sem estratégia",
    description: "Trabalha 10h por dia no celular, mas sem direção.",
  },
];

const features = [
  { icon: Target, title: "Matriz de 30 Dias", description: "IA cria uma estratégia personalizada de conteúdo para 30 dias baseada no SEU nicho." },
  { icon: FileText, title: "Scripts Prontos", description: "Roteiros completos para cada dia com hooks que prendem e CTAs que convertem." },
  { icon: Calendar, title: "Guia Diário", description: "Todo dia você sabe exatamente o que fazer, postar e falar." },
  { icon: Wrench, title: "Ferramentas IA", description: "Analise padrões de virais, desconstrua hooks e adapte conteúdos." },
  { icon: Mic, title: "Transcrição Inteligente", description: "Envie vídeos ou áudios virais e a IA transcreve automaticamente." },
  { icon: Sparkles, title: "Análise Visceral", description: "A IA mapeia as dores, desejos e gatilhos emocionais da sua audiência." },
];

const benefits = [
  "Estratégia completa de 30 dias personalizada por IA",
  "Scripts prontos para cada dia com hooks virais",
  "Guia diário — nunca mais 'o que postar hoje?'",
  "4 ferramentas IA avançadas de análise de conteúdo",
  "Transcrição de vídeos e áudios virais",
  "Análise visceral da sua audiência",
  "Acompanhamento de progresso e streak",
  "Atualizações e novas ferramentas incluídas",
];

const faqs = [
  { question: "Funciona para qualquer nicho?", answer: "Sim! No onboarding você informa seu nicho e a IA personaliza 100% do conteúdo." },
  { question: "Preciso ter muitos seguidores?", answer: "Não. O InfluLab foi feito tanto para quem está começando quanto para quem já tem audiência." },
  { question: "É diferente do ChatGPT?", answer: "Completamente. O InfluLab usa uma metodologia proprietária de análise visceral." },
  { question: "Posso cancelar quando quiser?", answer: "Sim, sem multa e sem burocracia." },
  { question: "Em quanto tempo vejo resultados?", answer: "Muitos usuários relatam aumento de engajamento já na primeira semana." },
  { question: "O conteúdo gerado é único?", answer: "100% único. A IA cria conteúdo original baseado no seu perfil." },
];

export default function Landing() {
  const navigate = useNavigate();
  const { canInstall, isIOS, hasNativePrompt, promptInstall } = useInstallPrompt();

  const handleDownload = async () => {
    if (hasNativePrompt) {
      await promptInstall();
    } else if (isIOS) {
      toast.info('Toque no botão Compartilhar (▢↑) e depois em "Adicionar à Tela de Início"', { duration: 8000 });
    } else {
      toast.info('Acesse pelo celular para instalar o app', { duration: 5000 });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container max-w-6xl mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl font-bold text-primary">InfluLab</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Entrar</Button>
            <Button size="sm" onClick={() => navigate("/auth")}>Começar grátis</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-charcoal">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[60%] h-full bg-gradient-to-bl from-primary/30 via-accent/15 to-transparent" />
          <div className="absolute top-20 left-[20%] w-72 h-72 rounded-full bg-primary/8 blur-[100px]" />
        </div>
        <div className="container max-w-6xl mx-auto px-4 pt-24 pb-16 relative z-10">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/15 rounded-full px-3 py-1 mb-6 border border-primary/20">
                <Sparkles className="h-3.5 w-3.5" /> Powered by IA Visceral
              </span>
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight text-white mb-5">
                Pare de postar no escuro.{" "}
                <span className="text-primary">Sua estratégia de 30 dias</span> começa aqui.
              </h1>
              <p className="text-white/65 text-lg sm:text-xl max-w-xl mb-8 leading-relaxed">
                A IA que entende a alma da sua audiência e cria uma estratégia completa de conteúdo personalizada pro seu nicho.
              </p>
              <div className="flex flex-col sm:flex-row items-start gap-3">
                <Button size="lg" onClick={() => navigate("/auth")} className="px-8 py-6 text-base font-semibold shadow-lg shadow-primary/25">
                  Começar grátis — 7 dias <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
                {canInstall && (
                  <Button size="lg" variant="outline" onClick={handleDownload} className="border-white/20 text-white hover:bg-white/10 px-6 py-6">
                    📲 Baixar App
                  </Button>
                )}
                <span className="text-xs text-white/40 self-center">Sem cartão de crédito</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <LandingFeatureBar />

      {/* Pain Points */}
      <Section className="py-20 px-4 bg-charcoal">
        <div className="container max-w-4xl mx-auto">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-center mb-3 text-white">Se identificou com alguma dessas?</h2>
          <p className="text-white/50 text-center mb-10 max-w-lg mx-auto">Você não está só.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {painPoints.map((pain, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <Card className="border-white/10 bg-white/5 h-full backdrop-blur-sm">
                  <CardContent className="p-5">
                    <span className="text-2xl mb-2 block">{pain.icon}</span>
                    <h3 className="font-semibold text-base mb-1.5 text-white">{pain.title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{pain.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* Solution */}
      <Section className="py-20 px-4 bg-background">
        <div className="container max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-5">
            <Zap className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-4">E se uma IA criasse toda a sua estratégia em minutos?</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
            O InfluLab analisa seu nicho, mapeia os gatilhos emocionais da sua audiência e gera um plano completo de 30 dias.
          </p>
        </div>
      </Section>

      {/* Features */}
      <Section className="py-20 px-4 bg-charcoal">
        <div className="container max-w-5xl mx-auto">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-center mb-12 text-white">Tudo que você precisa para dominar seu nicho</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                <Card className="border-white/10 bg-white/5 h-full backdrop-blur-sm group">
                  <CardContent className="p-5">
                    <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-primary/20 mb-3">
                      <feat.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-base mb-1.5 text-white">{feat.title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{feat.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* Social Proof */}
      <Section className="py-20 px-4 bg-background">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-10">Quem usa, transforma</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { name: "Camila R.", niche: "Fitness", quote: "Em 2 semanas meu engajamento triplicou." },
              { name: "Juliana M.", niche: "Beleza", quote: "Os scripts são absurdos de bons." },
              { name: "Fernanda S.", niche: "Lifestyle", quote: "Antes eu levava horas planejando. Agora tenho 30 dias prontos em 5 minutos." },
            ].map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="border-border/60 h-full text-left">
                  <CardContent className="p-5">
                    <div className="flex gap-0.5 mb-3">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="h-3.5 w-3.5 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-sm text-foreground mb-3 leading-relaxed italic">"{t.quote}"</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">{t.name.charAt(0)}</div>
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.niche}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* Pricing */}
      <Section className="py-24 px-4 bg-charcoal">
        <div className="container max-w-md mx-auto">
          <Card className="border-primary/30 shadow-2xl shadow-primary/15 relative overflow-hidden bg-white/5 backdrop-blur-sm">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
            <CardContent className="p-8 text-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/15 rounded-full px-3 py-1 mb-4 border border-primary/20">
                <Crown className="h-3.5 w-3.5" /> Acesso completo
              </span>
              <h3 className="font-serif text-2xl font-bold mb-1 text-white">InfluLab Pro</h3>
              <p className="text-white/50 text-sm mb-6">Tudo que você precisa para crescer</p>
              <div className="mb-6 space-y-2">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-sm text-white/50">R$</span>
                  <span className="text-5xl font-bold tracking-tight text-white">33</span>
                  <span className="text-white/50 text-sm">/mês</span>
                </div>
                <p className="text-xs text-white/40">no plano anual de R$397 <span className="text-primary font-medium">• Economize 30%</span></p>
                <p className="text-xs text-white/30">ou R$47/mês no plano mensal</p>
              </div>
              <ul className="text-left space-y-2.5 mb-8">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-white/80">{b}</span>
                  </li>
                ))}
              </ul>
              <Button size="lg" onClick={() => navigate("/auth")} className="w-full py-6 text-base font-semibold shadow-lg shadow-primary/25">
                Testar 7 dias grátis <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              <p className="text-xs text-white/40 mt-3">Comece grátis, assine quando quiser</p>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* FAQ */}
      <Section className="py-20 px-4 bg-background">
        <div className="container max-w-2xl mx-auto">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-center mb-8">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4 bg-card/80">
                <AccordionTrigger className="text-sm font-medium text-left hover:no-underline">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>

      {/* Final CTA */}
      <Section className="py-24 px-4 bg-charcoal relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-[30%] w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
        </div>
        <div className="container max-w-3xl mx-auto text-center relative z-10">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-4 text-white">Sua audiência está esperando.</h2>
          <p className="text-white/50 mb-8 max-w-lg mx-auto">Em 5 minutos você terá uma estratégia completa de 30 dias.</p>
          <Button size="lg" onClick={() => navigate("/auth")} className="px-8 py-6 text-base font-semibold shadow-lg shadow-primary/25">
            Começar meu teste grátis <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4 bg-charcoal">
        <div className="container max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <span className="font-serif font-bold text-primary">InfluLab</span>
          <p>© {new Date().getFullYear()} InfluLab. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
