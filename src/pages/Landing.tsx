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
  Brain,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroIllustration from "@/assets/hero-illustration.png";
import avatar1 from "@/assets/avatars/avatar-1.png";
import avatar2 from "@/assets/avatars/avatar-2.png";
import avatar3 from "@/assets/avatars/avatar-3.png";
import avatar4 from "@/assets/avatars/avatar-4.png";
import avatar5 from "@/assets/avatars/avatar-5.png";

const heroAvatars = [
  { src: avatar1, alt: "Criador Vyral Lab" },
  { src: avatar2, alt: "Criadora Vyral Lab" },
  { src: avatar3, alt: "Criadores Vyral Lab" },
  { src: avatar4, alt: "Criador Vyral Lab" },
  { src: avatar5, alt: "Criadora Vyral Lab" },
];

import { LandingFeatureBar } from "@/components/landing/FeatureBar";
import { InAppBrowserBanner } from "@/components/InAppBrowserBanner";
import { StatsBar } from "@/components/landing/StatsBar";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ComparisonTable } from "@/components/landing/ComparisonTable";
import { GuaranteeBlock } from "@/components/landing/GuaranteeBlock";
import { FloatingNav } from "@/components/landing/FloatingNav";
import { RealtimeTracker } from "@/components/landing/RealtimeTracker";
import { NichesMarquee } from "@/components/landing/NichesMarquee";

function Section({
  children,
  className = "",
  delay = 0,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  id?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  return (
    <motion.section
      ref={ref}
      id={id}
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
    description:
      "Você cria conteúdo, segue tendências, mas o algoritmo parece te ignorar. Curtidas de amigos não pagam suas contas.",
  },
  {
    icon: "🤯",
    title: "Não sabe o que postar amanhã",
    description:
      "Aquela sensação de abrir o celular e não ter a menor ideia do que criar. O bloqueio criativo vira rotina.",
  },
  {
    icon: "😔",
    title: "Vê outros crescendo e você parado(a)",
    description:
      "Outros criadores com menos talento crescem rápido. Você se pergunta: 'O que eles têm que eu não tenho?'",
  },
  {
    icon: "🔥",
    title: "Burnout de criar sem estratégia",
    description:
      "Trabalha 10h por dia no celular, mas sem direção. Cansaço sem resultado é a receita do esgotamento.",
  },
];

const features = [
  { icon: Target, title: "Matriz de 30 Dias", description: "IA cria uma estratégia personalizada de conteúdo para 30 dias baseada no SEU nicho, audiência e estilo." },
  { icon: FileText, title: "Scripts Prontos", description: "Roteiros completos para cada dia com hooks que prendem, storytelling que conecta e CTAs que convertem." },
  { icon: Calendar, title: "Guia Diário", description: "Todo dia você sabe exatamente o que fazer, postar e falar. Sem dúvida, sem bloqueio criativo." },
  { icon: Wrench, title: "Ferramentas IA", description: "Analise padrões de virais, desconstrua hooks e adapte conteúdos que já funcionaram para o seu nicho." },
  { icon: Mic, title: "Transcrição Inteligente", description: "Envie vídeos ou áudios virais e a IA transcreve automaticamente para você analisar e adaptar." },
  { icon: Brain, title: "Análise Visceral", description: "A IA mapeia as dores, desejos e gatilhos emocionais da sua audiência para criar conteúdo que toca na alma." },
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
  { question: "Funciona para qualquer nicho?", answer: "Sim! No onboarding você informa seu nicho (Fitness, Beleza, Moda, Educação, Lifestyle, etc.) e a IA personaliza 100% do conteúdo para o seu mercado específico." },
  { question: "Preciso ter muitos seguidores?", answer: "Não. O Vyral Lab foi feito tanto para quem está começando quanto para quem já tem audiência e quer escalar. A estratégia se adapta ao seu estágio atual." },
  { question: "É diferente do ChatGPT?", answer: "Completamente. O ChatGPT é genérico. O Vyral Lab usa uma metodologia proprietária de análise visceral que mapeia os gatilhos emocionais reais da sua audiência e cria estratégias baseadas em psicologia de persuasão." },
  { question: "Posso cancelar quando quiser?", answer: "Sim, sem multa e sem burocracia. Você pode cancelar sua assinatura a qualquer momento direto no app e mantém acesso até o fim do período já pago." },
  { question: "Qual a diferença entre o plano mensal e o anual?", answer: "O plano mensal custa R$47/mês. O anual custa R$297 à vista — equivalente a R$24,75/mês, uma economia de R$267 por ano (47% off). Mesmas funcionalidades, mesmo acesso ilimitado." },
  { question: "Em quanto tempo vejo resultados?", answer: "Muitos usuários relatam aumento de engajamento já na primeira semana seguindo a estratégia. Os 30 dias completos trazem uma transformação significativa na sua presença digital." },
  { question: "O conteúdo gerado é único ou copiado?", answer: "100% único. A IA cria conteúdo original baseado no seu perfil, estilo e audiência. Nenhum outro criador terá o mesmo conteúdo que você." },
];

export default function Landing() {
  const navigate = useNavigate();
  const scrollToPlanos = () =>
    document.getElementById("planos")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="landing-dark min-h-screen bg-background text-foreground overflow-x-hidden">
      <InAppBrowserBanner />
      <FloatingNav onPlansClick={scrollToPlanos} />

      {/* ─── Hero ─── */}
      <section id="inicio" className="relative min-h-[100vh] flex items-center overflow-hidden pt-28 pb-16">
        {/* Background orbs */}
        <div className="neon-orb w-[520px] h-[520px] -top-32 -left-32 bg-primary/40" />
        <div className="neon-orb w-[480px] h-[480px] top-1/3 -right-32 bg-accent/35" />
        <div className="neon-orb w-[320px] h-[320px] bottom-0 left-1/3 bg-primary/25 animate-float-slow" />

        <div className="container max-w-6xl mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Left — Copy */}
            <motion.div
              initial={{ opacity: 0, x: -30, filter: "blur(6px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-left"
            >
              <span className="neon-chip mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                A IA por trás dos criadores que crescem
                <Star className="h-3.5 w-3.5 fill-current" />
              </span>

              <h1
                className="font-sans font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-[1.02] tracking-tight text-white mb-6"
                style={{ textWrap: "balance" }}
              >
                Sua estratégia<br />
                de <span className="neon-text">influência</span>,<br />
                pronta em minutos
              </h1>

              <p className="text-white/70 text-lg sm:text-xl max-w-xl mb-4 leading-relaxed font-medium">
                Mais rápido, mais profundo e do jeito que sua audiência precisa.
              </p>
              <p className="text-white/55 text-base max-w-xl mb-8 leading-relaxed">
                Em poucos cliques, a IA monta uma matriz completa de 30 dias — scripts, hooks, storytelling e CTAs — personalizada para o seu nicho.
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-6">
                <Button
                  size="lg"
                  onClick={scrollToPlanos}
                  className="neon-cta rounded-full px-7 py-6 text-base font-semibold active:scale-[0.97] transition-transform"
                >
                  Começar agora
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}
                  className="rounded-full px-6 py-6 text-base font-semibold text-white/85 hover:text-white hover:bg-white/10 border border-white/15"
                >
                  Como funciona
                </Button>
              </div>

              {/* Social proof */}
              <div className="mt-2 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {heroAvatars.map((a, i) => (
                    <img
                      key={i}
                      src={a.src}
                      alt={a.alt}
                      loading="lazy"
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-background"
                    />
                  ))}
                </div>
                <div className="text-xs text-white/70">
                  <div className="font-semibold text-white">+1.200 criadores ativos</div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 pl-4 border-l border-white/15">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-sm text-white/80 font-semibold">4.9/5</span>
                </div>
              </div>
            </motion.div>

            {/* Right — Mockup with floating cards */}
            <motion.div
              initial={{ opacity: 0, x: 30, filter: "blur(6px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex justify-center lg:justify-end"
            >
              <div className="relative">
                {/* Glow halo behind mockup */}
                <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-primary/40 to-accent/30 blur-3xl -z-10 scale-90" />

                <img
                  src={heroIllustration}
                  alt="Vyral Lab — Estratégia para todos os nichos"
                  className="w-full max-w-md mx-auto drop-shadow-2xl animate-float-slow"
                />

                {/* Floating card — Top */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="absolute -left-4 sm:-left-10 top-10 neon-card p-3 pr-5 flex items-center gap-3 shadow-2xl"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Matriz gerada</p>
                    <p className="text-[10px] text-white/55">30 dias prontos</p>
                  </div>
                </motion.div>

                {/* Floating card — Bottom */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  className="absolute -right-2 sm:-right-6 bottom-16 neon-card p-3 pr-5 flex items-center gap-3 shadow-2xl"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Tarefa concluída</p>
                    <p className="text-[10px] text-white/55">+1 dia de streak</p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <StatsBar />
      <LandingFeatureBar />

      {/* ─── Realtime Tracker ─── */}
      <RealtimeTracker />

      {/* ─── Pain Points ─── */}
      <Section className="py-20 px-4">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="neon-chip mb-4">Você se reconhece?</span>
            <h2 className="font-sans font-extrabold text-3xl sm:text-4xl text-white tracking-tight mb-3"
                style={{ textWrap: "balance" }}>
              Posta todo dia, mas ninguém <span className="neon-text">vê</span>
            </h2>
            <p className="text-white/55 max-w-lg mx-auto">
              Milhares de criadores passam por isso. A boa notícia: tem solução.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {painPoints.map((pain, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="neon-card p-5 h-full transition">
                  <span className="text-2xl mb-2 block">{pain.icon}</span>
                  <h3 className="font-semibold text-base mb-1.5 text-white">{pain.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{pain.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── Solution Transition ─── */}
      <Section className="py-20 px-4">
        <div className="container max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 mb-5 step-pulse">
            <Zap className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-sans font-extrabold text-3xl sm:text-4xl text-white tracking-tight mb-4"
              style={{ textWrap: "balance" }}>
            E se uma IA criasse <span className="neon-text">tudo</span> em minutos?
          </h2>
          <p className="text-white/60 text-lg max-w-xl mx-auto leading-relaxed">
            O Vyral Lab analisa seu nicho, mapeia gatilhos emocionais e gera 30 dias completos — scripts, hooks e storytelling prontos.
          </p>
        </div>
      </Section>

      {/* ─── Features Grid ─── */}
      <Section className="py-20 px-4" id="recursos">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="neon-chip mb-4">Recursos</span>
            <h2 className="font-sans font-extrabold text-3xl sm:text-4xl text-white tracking-tight"
                style={{ textWrap: "balance" }}>
              Tudo pra dominar o seu <span className="neon-text">nicho</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="neon-card p-5 h-full group transition">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 mb-3 group-hover:scale-110 transition-transform">
                    <feat.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-base mb-1.5 text-white">{feat.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{feat.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── Niches Marquee ─── */}
      <NichesMarquee />

      {/* ─── How It Works ─── */}
      <div id="como-funciona"><HowItWorks /></div>

      {/* ─── Social Proof ─── */}
      <Section className="py-20 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <span className="neon-chip mb-4">Depoimentos</span>
          <h2 className="font-sans font-extrabold text-3xl sm:text-4xl text-white tracking-tight mb-3">
            Quem usa, <span className="neon-text">transforma</span>
          </h2>
          <p className="text-white/55 mb-10 max-w-lg mx-auto">
            Veja o que criadores estão dizendo sobre o Vyral Lab.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { name: "Camila R.", niche: "Fitness", quote: "Em 2 semanas meu engajamento triplicou. Nunca mais fiquei sem saber o que postar." },
              { name: "Juliana M.", niche: "Beleza", quote: "Os scripts são absurdos de bons. Parece que a IA lê a mente das minhas seguidoras." },
              { name: "Fernanda S.", niche: "Lifestyle", quote: "Antes eu levava horas planejando. Agora tenho 30 dias prontos em 5 minutos." },
            ].map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="neon-card p-5 h-full text-left">
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-white/85 mb-3 leading-relaxed italic">"{t.quote}"</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-semibold text-white">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{t.name}</p>
                      <p className="text-xs text-white/50">{t.niche}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      <ComparisonTable />

      {/* ─── Pricing ─── */}
      <div id="planos" className="scroll-mt-20">
        <Section className="py-24 px-4 relative overflow-hidden">
          <div className="neon-orb w-[500px] h-[500px] -top-24 left-1/2 -translate-x-1/2 bg-primary/25" />
          <div className="container max-w-3xl mx-auto relative z-10">
            <div className="text-center mb-10">
              <span className="neon-chip mb-4">Planos</span>
              <h2 className="font-sans font-extrabold text-3xl md:text-5xl text-white tracking-tight mb-2">
                Escolha seu <span className="neon-text">plano</span>
              </h2>
              <p className="text-white/60 text-sm">Mesmo acesso completo nos dois. Cancele quando quiser.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              {/* Mensal */}
              <Card className="neon-card relative overflow-hidden flex flex-col border-0">
                <CardContent className="p-7 text-center flex flex-col flex-1">
                  <span className="neon-chip mb-3 self-center">Mensal</span>
                  <h3 className="font-sans font-extrabold text-2xl mb-1 text-white">Vyral Lab Pro</h3>
                  <p className="text-white/50 text-sm mb-6">Pague mês a mês</p>
                  <div className="mb-6 space-y-2">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-sm text-white/50">R$</span>
                      <span className="text-5xl font-extrabold tracking-tight text-white">47</span>
                      <span className="text-white/50 text-sm">/mês</span>
                    </div>
                    <p className="text-xs text-white/50">Cobrado todo mês • cancele quando quiser</p>
                  </div>
                  <ul className="text-left space-y-2.5 mb-8 flex-1">
                    {benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-white/60 shrink-0 mt-0.5" />
                        <span className="text-white/80">{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/auth?plan=monthly&mode=signup")}
                    className="w-full rounded-full border-white/25 bg-transparent text-white hover:bg-white/10 py-6 text-base font-semibold active:scale-[0.97] transition-transform"
                  >
                    Assinar mensal <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>

              {/* Anual destaque */}
              <Card className="neon-card relative overflow-hidden flex flex-col border-0 shadow-2xl"
                    style={{ boxShadow: "var(--shadow-neon)" }}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
                <CardContent className="p-7 text-center flex flex-col flex-1">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-primary to-accent text-white px-2.5 py-1 rounded-full mb-3 self-center">
                    <Crown className="h-3.5 w-3.5" /> Mais escolhido • 47% off
                  </span>
                  <h3 className="font-sans font-extrabold text-2xl mb-1 text-white">Vyral Lab Pro</h3>
                  <p className="text-white/50 text-sm mb-6">Pague 1x no ano e economize</p>
                  <div className="mb-6 space-y-2">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-sm text-white/50">R$</span>
                      <span className="text-5xl font-extrabold tracking-tight text-white">297</span>
                      <span className="text-white/50 text-sm">/ano</span>
                    </div>
                    <p className="text-xs text-white/70">
                      Equivale a <span className="font-semibold text-white">R$24,75/mês</span>
                      <span className="neon-text font-medium"> • economize R$267</span>
                    </p>
                    <p className="text-xs text-white/40">
                      <span className="line-through text-white/30">R$564/ano</span> se pago mensalmente
                    </p>
                  </div>
                  <ul className="text-left space-y-2.5 mb-8 flex-1">
                    {benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-white/85">{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="lg"
                    onClick={() => navigate("/auth?plan=yearly&mode=signup")}
                    className="neon-cta w-full rounded-full py-6 text-base font-semibold active:scale-[0.97] transition-transform"
                  >
                    Assinar plano anual <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                  <p className="text-xs text-white/40 mt-3">Acesso imediato • Cancele a qualquer momento</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </Section>
      </div>

      <GuaranteeBlock />

      {/* ─── FAQ ─── */}
      <Section id="faq" className="py-20 px-4">
        <div className="container max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <span className="neon-chip mb-4">FAQ</span>
            <h2 className="font-sans font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
              Perguntas <span className="neon-text">frequentes</span>
            </h2>
          </div>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="neon-card px-4 border-0"
              >
                <AccordionTrigger className="text-sm font-medium text-left text-white hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-white/65 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>

      {/* ─── Final CTA ─── */}
      <Section className="py-24 px-4 relative overflow-hidden">
        <div className="neon-orb w-[600px] h-[600px] top-0 left-1/2 -translate-x-1/2 bg-primary/30" />
        <div className="container max-w-3xl mx-auto text-center relative z-10">
          <h2 className="font-sans font-extrabold text-3xl sm:text-5xl text-white tracking-tight mb-4"
              style={{ textWrap: "balance" }}>
            Sua audiência está <span className="neon-text">esperando</span>
          </h2>
          <p className="text-white/60 mb-8 max-w-lg mx-auto text-lg">
            Em 5 minutos você terá uma estratégia completa de 30 dias personalizada pro seu nicho.
          </p>
          <Button
            size="lg"
            onClick={scrollToPlanos}
            className="neon-cta rounded-full px-8 py-7 text-lg font-semibold active:scale-[0.97] transition-transform"
          >
            Começar agora <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </Section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/10 py-8 px-4">
        <div className="container max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <p>© {new Date().getFullYear()} Vyral Lab. Todos os direitos reservados.</p>
          <p className="neon-text font-semibold">Feito com IA para criadores</p>
        </div>
      </footer>
    </div>
  );
}
