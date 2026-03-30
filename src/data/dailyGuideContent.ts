// This file contains dailyGuideContent - copy from source
import { DayStrategy } from './strategies';

export interface GuideSection {
  icon: string;
  title: string;
  items: string[];
}

const contentTypesByPillar: Record<string, string[]> = {
  beleza: [
    'Reels tutorial passo a passo',
    'Carrossel antes/depois',
    'Story com enquete interativa',
    'Vídeo "O que uso no dia a dia"',
    'Post estático com dica rápida',
  ],
  fitness: [
    'Reels de treino em tempo real',
    'Carrossel com série de exercícios',
    'Story mostrando refeição do dia',
    'Vídeo "Minha evolução em X meses"',
    'Post motivacional com foto pessoal',
  ],
  'vida-real': [
    'Reels storytelling pessoal',
    'Carrossel reflexivo com frases',
    'Story "Um dia na minha vida"',
    'Vídeo desabafo autêntico',
    'Post foto real + legenda profunda',
  ],
  negocios: [
    'Reels com dica de empreendedorismo',
    'Carrossel "Erros que cometi"',
    'Story bastidores do trabalho',
    'Vídeo mostrando resultados reais',
    'Post com prova social ou depoimento',
  ],
  principal: [
    'Reels mostrando autoridade no nicho',
    'Carrossel com dicas práticas',
    'Story com enquete do nicho',
    'Vídeo "Minha rotina no nicho"',
    'Post com conteúdo de valor',
  ],
  lifestyle: [
    'Reels de rotina e autocuidado',
    'Carrossel "Um dia na minha vida"',
    'Story mostrando momentos reais',
    'Vídeo lifestyle inspiracional',
    'Post com foto aesthetic + legenda',
  ],
};

const videoFormatsByPillar: Record<string, string[]> = {
  beleza: [
    'POV espelho do banheiro',
    'Transição antes/depois com corte',
    'Close-up ASMR dos produtos',
    'Get Ready With Me (GRWM)',
    'Walk and talk mostrando resultado',
  ],
  fitness: [
    'Câmera fixa no treino (time-lapse)',
    'POV primeira pessoa treinando',
    'Split screen antes/depois',
    'Vlog estilo "acompanhe meu dia"',
    'Talking head com B-roll de treino',
  ],
  'vida-real': [
    'Talking head olhando na câmera',
    'Vlog lo-fi do cotidiano',
    'Câmera no carro desabafando',
    'Montagem com fotos + narração',
    'Walk and talk na rua ou parque',
  ],
  negocios: [
    'Talking head profissional',
    'Tela gravada + narração (tutorial)',
    'Bastidores com câmera no ombro',
    'Entrevista/depoimento estilo podcast',
    'Montagem rápida de rotina de trabalho',
  ],
  principal: [
    'Talking head com autoridade',
    'POV mostrando processo do nicho',
    'Vlog do dia a dia no nicho',
    'Tutorial prático passo a passo',
    'Montagem de resultados e evolução',
  ],
  lifestyle: [
    'Vlog aesthetic do cotidiano',
    'GRWM com narração relaxante',
    'Walk and talk em local bonito',
    'Montagem de rotina com música',
    'Câmera fixa mostrando momento real',
  ],
};

const defaultContent = [
  'Reels com conteúdo de valor',
  'Carrossel informativo',
  'Story interativa',
  'Vídeo autêntico',
  'Post com legenda envolvente',
];

const defaultFormats = [
  'Talking head olhando na câmera',
  'Vlog do dia a dia',
  'Montagem com fotos + narração',
  'Walk and talk',
  'POV mostrando bastidores',
];

function generateHooks(strategy: DayStrategy): string[] {
  const themeHooks: string[] = [];
  if (strategy.viralHook) {
    themeHooks.push(strategy.viralHook);
  }
  const title = strategy.title.toLowerCase();
  const visceral = strategy.visceralElement || '';
  themeHooks.push(`"Ninguém te conta a verdade sobre ${title}…"`);
  themeHooks.push(`"Isso mudou tudo quando eu entendi sobre ${title}"`);
  if (visceral) {
    themeHooks.push(`"${visceral} — e foi isso que me fez mudar"`);
  }
  const pillarExtras: Record<string, string> = {
    beleza: '"O segredo que ninguém conta sobre cuidados pessoais"',
    fitness: '"Pare de fazer ISSO se quer resultados de verdade"',
    'vida-real': '"Essa lição mudou minha forma de ver a vida"',
    negocios: '"A estratégia mais simples que muda tudo"',
    principal: '"Essa dica mudou completamente meus resultados"',
    lifestyle: '"O hábito mais simples que transformou minha rotina"',
  };
  themeHooks.push(pillarExtras[strategy.pillar] || '"Isso muda tudo quando você entende"');
  return themeHooks;
}

function generateStorytelling(strategy: DayStrategy): string[] {
  const stories: string[] = [];
  if (strategy.storytellingBody) {
    const body = strategy.storytellingBody.length > 120
      ? strategy.storytellingBody.substring(0, 117) + '…'
      : strategy.storytellingBody;
    stories.push(body);
  }
  const title = strategy.title;
  stories.push(`Conte como "${title}" impactou sua jornada pessoal`);
  stories.push(`Compartilhe um momento real que se conecta com o tema "${title}"`);
  stories.push(`Fale sobre uma lição que aprendeu relacionada a "${title}"`);
  const pillarExtra: Record<string, string> = {
    beleza: 'Mostre sua evolução e como isso mudou sua confiança',
    fitness: 'Conte o dia que quase desistiu e o que te fez voltar',
    'vida-real': 'Compartilhe um momento de vulnerabilidade que conectou você com seu público',
    negocios: 'Mostre os bastidores que ninguém vê do seu trabalho',
    principal: 'Relate como uma pessoa te inspirou nessa jornada',
    lifestyle: 'Conte sobre uma mudança de hábito que transformou sua rotina',
  };
  stories.push(pillarExtra[strategy.pillar] || 'Compartilhe algo autêntico da sua experiência');
  return stories;
}

function generateCTAs(strategy: DayStrategy): string[] {
  const ctas: string[] = [];
  if (strategy.subtleConversion) {
    ctas.push(strategy.subtleConversion);
  }
  ctas.push('"Gostou desse conteúdo? Salva e compartilha com alguém que precisa ver isso! 💕"');
  ctas.push('"Me conta nos comentários: você já sabia disso? Quero ouvir vocês! 💬"');
  ctas.push('"Quer mais dicas assim? Me segue e ativa o sininho pra não perder nada 🔔"');
  ctas.push('"Se esse conteúdo fez sentido pra você, manda pra alguém especial ✨"');
  return ctas;
}

export function getDailyGuideContent(strategy: DayStrategy): GuideSection[] {
  return [
    {
      icon: '🎯',
      title: 'Tipos de Conteúdo',
      items: contentTypesByPillar[strategy.pillar] || defaultContent,
    },
    {
      icon: '🪝',
      title: 'Hooks Virais',
      items: generateHooks(strategy),
    },
    {
      icon: '🎬',
      title: 'Formatos de Vídeo',
      items: videoFormatsByPillar[strategy.pillar] || defaultFormats,
    },
    {
      icon: '📖',
      title: 'Storytelling + Conexão',
      items: generateStorytelling(strategy),
    },
    {
      icon: '💰',
      title: 'CTAs de Conversão',
      items: generateCTAs(strategy),
    },
  ];
}
