import { DayStrategy, Pillar } from './strategies';

export interface WeeklyTheme {
  name: string;
  emoji: string;
  objective: string;
}

export const weeklyThemes: Record<number, WeeklyTheme> = {
  1: { name: 'Inspiração', emoji: '✨', objective: 'Começar a semana motivando a audiência' },
  2: { name: 'Dica Técnica', emoji: '🎓', objective: 'Mostrar autoridade no que faz' },
  3: { name: 'Vulnerabilidade', emoji: '💔', objective: 'Storytelling pesado, falar de cansaço e erros' },
  4: { name: 'Nostalgia (TBT)', emoji: '📸', objective: 'Mostrar progresso e vender o sonho da ascensão' },
  5: { name: 'Estética & Luxo', emoji: '💎', objective: 'Elevar o desejo e mostrar os frutos do trabalho' },
  6: { name: 'Família & Lazer', emoji: '👨‍👩‍👧', objective: 'Humanização total' },
  0: { name: 'Antecipação', emoji: '🔮', objective: '"Domingou" com foco na ação que vem' },
};

export const dayOfWeekNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const feedPostDays = [1, 3, 5];

export interface ScheduleTask {
  key: string;
  time: string;
  label: string;
  description: string;
  points: number;
  examples?: string[];
}

export interface TimeBlock {
  id: 'morning' | 'afternoon' | 'night';
  title: string;
  subtitle: string;
  emoji: string;
  tasks: ScheduleTask[];
}

export interface DailyScheduleData {
  dayOfWeek: number;
  dayOfWeekName: string;
  weeklyTheme: WeeklyTheme;
  blocks: TimeBlock[];
  cliffhanger: string;
  cliffhangerOptions: string[];
  isFeedDay: boolean;
  totalTasks: number;
}

const cliffhangers: string[] = [
  'Amanhã vou contar uma coisa que aconteceu hoje que eu ainda não estou acreditando… boa noite!',
  'Gente, recebi uma mensagem agora que mudou TUDO. Amanhã conto pra vocês…',
  'Preparem-se porque amanhã vai ser o dia mais intenso até agora. Durmam bem!',
  'Eu não devia contar isso… mas amanhã eu abro o jogo sobre algo que guardei por semanas.',
  'O que aconteceu depois que desliguei a câmera hoje… vocês não vão acreditar. Amanhã mostro.',
  'Amanhã vou fazer algo que NUNCA fiz aqui. Não percam.',
  'Recebi um presente inesperado hoje. Amanhã mostro e conto a história por trás.',
  'Tomei uma decisão grande hoje. Amanhã vocês vão entender por quê.',
  'Vocês pediram e eu vou entregar. Amanhã tem surpresa!',
  'Hoje chorei gravando um vídeo. Amanhã vocês vão ver o porquê.',
  'Descobri algo sobre mim hoje que me deixou sem chão. Amanhã compartilho.',
  'O resultado que saiu hoje me deixou de queixo caído. Amanhã mostro os números!',
  'Alguém mandou uma DM que me fez repensar tudo. Amanhã leio pra vocês.',
  'Amanhã começa uma nova fase. E vocês vão fazer parte.',
  'Fiz algo pela primeira vez hoje e deu MUITO certo. Amanhã mostro!',
  'Tive uma conversa hoje que mudou minha perspectiva sobre tudo. Amanhã conto.',
  'Vocês não fazem ideia do que está chegando. Durmam bem porque amanhã vai ser GRANDE.',
  'Testei algo novo hoje e os resultados me surpreenderam. Amanhã revelo.',
  'Amanhã vou apresentar vocês a uma pessoa que mudou minha vida.',
  'Gravei algo hoje que me deu até arrepio. Amanhã sai!',
  'Eu estava errado(a) sobre uma coisa. Amanhã explico qual.',
  'Bastidores do que aconteceu hoje… vocês precisam ver. Amanhã posto.',
  'Amanhã é um dia especial e vocês vão entender por que estou tão ansiosa.',
  'Aconteceu algo no treino hoje que me fez chorar. Mas de alegria. Amanhã conto.',
  'Preparei algo o dia inteiro pra vocês. Amanhã é o dia!',
  'Alguém aqui me desafiou e eu aceitei. Amanhã mostro o resultado.',
  'Eu não estava preparado(a) pro que ouvi hoje. Amanhã vocês vão entender.',
  'Amanhã vai ser o antes e depois mais impactante que já mostrei.',
  'O anúncio que vocês esperavam… amanhã. Sem mais spoilers.',
  'Este é o último dia antes de TUDO mudar. Amanhã começa a nova era!',
];

function getContextualDescription(
  task: string,
  pillar: string,
  weeklyTheme: WeeklyTheme
): string {
  const pillarContext: Record<string, Record<string, string>> = {
    beleza: {
      morningInsight: `Story mostrando sua rotina de skincare matinal + reflexão sobre autocuidado`,
      morningPoll: `Enquete: "Vocês usam protetor solar TODO dia? 🧴 Sim / Confesso que não"`,
      reel: `Reels de beleza: tutorial, dica de produto ou transformação visual`,
      reelEngagement: `Responda comentários do Reels — pergunte "Qual produto vocês querem que eu teste?"`,
      valueStories: `Stories com dicas de make, skincare ou cabelo do dia`,
      lifestyleStory: `Momento self-care noturno: rotina de beleza + momento relaxante`,
      feedPost: `Post feed: foto de look, flat-lay de produtos ou carrossel de dicas`,
    },
    fitness: {
      morningInsight: `Story mostrando o pré-treino ou café da manhã saudável + insight sobre disciplina`,
      morningPoll: `Enquete: "Treino de manhã ou de noite? 💪 Manhã / Noite"`,
      reel: `Reels de treino: exercício do dia, evolução corporal ou dica de alimentação`,
      reelEngagement: `Responda comentários do Reels — desafie: "Quem topa fazer esse treino comigo?"`,
      valueStories: `Stories com série de exercícios, dica de alimentação ou progresso`,
      lifestyleStory: `Jantar saudável ou momento de recuperação pós-treino`,
      feedPost: `Post feed: foto de treino, antes/depois ou refeição do dia`,
    },
    'vida-real': {
      morningInsight: `Story "bom dia" real, sem filtro — frase que gere identificação`,
      morningPoll: `Enquete pessoal: "Vocês também sentem isso? 🫶 Sim, demais / Só eu?"`,
      reel: `Reels de storytelling pessoal: reflexão, superação ou momento real`,
      reelEngagement: `Responda comentários — crie conversa genuína com a audiência`,
      valueStories: `Stories mostrando seu dia real: casa, família, momentos espontâneos`,
      lifestyleStory: `Momento "novela": jantar em família, autocuidado ou momento íntimo`,
      feedPost: `Post feed: foto real com legenda profunda ou carrossel reflexivo`,
    },
    negocios: {
      morningInsight: `Story mostrando sua mesa de trabalho ou planejamento do dia + mentalidade de negócios`,
      morningPoll: `Enquete: "Vocês preferem trabalhar por paixão ou por dinheiro? 💰 Paixão / Dinheiro"`,
      reel: `Reels de empreendedorismo: dica de negócio, bastidores ou resultado`,
      reelEngagement: `Responda comentários — pergunte "Qual maior desafio de vocês no trabalho?"`,
      valueStories: `Stories com bastidores do trabalho, dicas de produtividade ou organização`,
      lifestyleStory: `Momento de descanso merecido após um dia produtivo`,
      feedPost: `Post feed: prova social, depoimento ou dica profissional`,
    },
    principal: {
      morningInsight: `Story mostrando sua rotina matinal do nicho + insight autêntico`,
      morningPoll: `Enquete rápida conectada ao seu nicho principal`,
      reel: `Reels com conteúdo de autoridade do seu nicho`,
      reelEngagement: `Responda comentários — crie comunidade no seu nicho`,
      valueStories: `Stories com dicas e valor do seu nicho principal`,
      lifestyleStory: `Momento lifestyle conectado ao seu nicho`,
      feedPost: `Post feed: conteúdo de valor do seu nicho principal`,
    },
    lifestyle: {
      morningInsight: `Story "bom dia" mostrando sua rotina real + momento de autocuidado`,
      morningPoll: `Enquete: "Vocês também fazem isso de manhã? ✨ Sim / Preciso começar"`,
      reel: `Reels de lifestyle: rotina, organização ou momento especial`,
      reelEngagement: `Responda comentários — crie conexão pessoal com a audiência`,
      valueStories: `Stories com dicas de rotina, autocuidado ou organização`,
      lifestyleStory: `Momento relaxante noturno: skincare, leitura ou ritual de descanso`,
      feedPost: `Post feed: foto lifestyle, flat-lay ou carrossel de rotina`,
    },
  };

  return pillarContext[pillar]?.[task] || pillarContext['vida-real']?.[task] || '';
}

const taskExamples: Record<string, Record<string, string[]>> = {
  beleza: {
    morningInsight: [
      '"Bom dia! Sabia que a vitamina C precisa de 15 min pra absorver antes do protetor?"',
      '"Acordei pensando: quanto do que compramos de skincare é necessidade vs. marketing?"',
      '"3 anos atrás eu não sabia o que era ácido hialurônico. Hoje minha pele agradece"',
    ],
    morningPoll: [
      '"Vocês lavam o rosto de manhã? 🧼 Sim, sempre / Só água"',
      '"Protetor solar com cor ou sem cor? ☀️ Com cor / Sem cor"',
    ],
    reel: [
      'Tutorial: "3 passos pra uma pele glow em 5 minutos"',
      'Antes e depois: aplicação de base com técnicas diferentes',
    ],
    reelEngagement: [
      'Pergunte: "Qual produto vocês querem que eu teste próximo?"',
    ],
    valueStories: [
      'Dica: como aplicar corretivo sem craquelar',
      'Passo a passo do contorno natural pro dia a dia',
    ],
    lifestyleStory: [
      'Rotina de skincare noturna com música relaxante',
      'Momento self-care: máscara facial + chá + série',
    ],
    feedPost: [
      'Carrossel: "5 erros de skincare que todo mundo comete"',
      'Flat-lay dos produtos do mês com mini review',
    ],
  },
  fitness: {
    morningInsight: [
      '"Bom dia! Sabia que 20 min de treino consistente vale mais que 2h esporádicas?"',
      '"Acordei às 5h pra treinar. Não é sobre motivação, é sobre rotina"',
    ],
    morningPoll: [
      '"Vocês treinam em jejum? 🏋️ Sim / Nunca"',
      '"Cardio antes ou depois da musculação? 🏃 Antes / Depois"',
    ],
    reel: [
      'Treino completo de 10 minutos sem equipamento',
      'Evolução corporal: 30 dias de transformação',
    ],
    reelEngagement: [
      'Desafie: "Quem topa fazer esse treino comigo? Postem o vídeo!"',
    ],
    valueStories: [
      'Série de exercícios para iniciantes em casa',
      'O que comer antes e depois do treino',
    ],
    lifestyleStory: [
      'Jantar saudável: preparando a marmita de amanhã',
    ],
    feedPost: [
      'Foto de treino com dicas na legenda',
      'Carrossel: "5 exercícios que todo iniciante deveria fazer"',
    ],
  },
  'vida-real': {
    morningInsight: [
      '"Bom dia! Hoje acordei pensando: por que a gente se cobra tanto?"',
    ],
    morningPoll: [
      '"Como vocês acordaram hoje? 😴 Bem / Precisava de mais 2h"',
    ],
    reel: [
      'Storytelling: "O dia que quase desisti de tudo"',
    ],
    reelEngagement: [
      'Pergunte: "Vocês também passam por isso? Contem nos comentários"',
    ],
    valueStories: [
      'Dica de organização pessoal que mudou sua rotina',
    ],
    lifestyleStory: [
      'Jantar em casa: cozinhando algo gostoso',
    ],
    feedPost: [
      'Foto real com legenda profunda sobre o momento de vida',
    ],
  },
  negocios: {
    morningInsight: [
      '"Bom dia! O maior ativo do seu negócio não é o produto, é a confiança"',
    ],
    morningPoll: [
      '"Vocês trabalham no fim de semana? 💼 Sim / Descanso sagrado"',
    ],
    reel: [
      '"3 dicas que aumentaram meu faturamento em 30 dias"',
    ],
    reelEngagement: [
      'Pergunte: "Qual o maior desafio do seu negócio hoje?"',
    ],
    valueStories: [
      'Dica de produtividade que mudou seu dia',
    ],
    lifestyleStory: [
      'Momento de descanso merecido após um dia produtivo',
    ],
    feedPost: [
      'Carrossel: "5 lições de negócios que ninguém ensina"',
    ],
  },
  lifestyle: {
    morningInsight: [
      '"Bom dia! Hoje resolvi que vou fazer pelo menos UMA coisa que me faz feliz"',
    ],
    morningPoll: [
      '"Vocês têm rotina matinal? ☀️ Sim / Caos total"',
    ],
    reel: [
      'Rotina matinal aesthetic em 30 segundos',
    ],
    reelEngagement: [
      'Pergunte: "Qual item vocês não vivem sem na rotina?"',
    ],
    valueStories: [
      'Dica de organização que transformou sua rotina',
    ],
    lifestyleStory: [
      'Rotina noturna relaxante com skincare',
    ],
    feedPost: [
      'Flat-lay aesthetic dos favoritos do mês',
    ],
  },
  principal: {
    morningInsight: [
      '"Bom dia! Hoje quero compartilhar algo que aprendi recentemente no meu nicho"',
    ],
    morningPoll: [
      '"Vocês preferem conteúdo educativo ou motivacional? 📚 Educativo / Motivacional"',
    ],
    reel: [
      'Dica rápida de autoridade: "Você sabia que..."',
    ],
    reelEngagement: [
      'Pergunte: "Qual a maior dúvida de vocês sobre [nicho]?"',
    ],
    valueStories: [
      'Dica prática aplicável do seu nicho',
    ],
    lifestyleStory: [
      'Bastidores da sua vida fora do trabalho',
    ],
    feedPost: [
      'Carrossel educativo: "5 dicas essenciais sobre [nicho]"',
    ],
  },
};

function getTaskExamples(taskKey: string, pillar: string): string[] {
  return taskExamples[pillar]?.[taskKey] || taskExamples['principal']?.[taskKey] || [];
}

export function getCliffhangerOptions(day: number): string[] {
  const startIdx = ((day - 1) * 3) % cliffhangers.length;
  const options: string[] = [];
  for (let i = 0; i < 5; i++) {
    options.push(cliffhangers[(startIdx + i) % cliffhangers.length]);
  }
  return options;
}

export function getDailySchedule(day: number, strategy: DayStrategy, startDate: string): DailyScheduleData {
  const start = new Date(startDate + 'T00:00:00');
  const current = new Date(start);
  current.setDate(current.getDate() + day - 1);
  const dayOfWeek = current.getDay();
  const theme = weeklyThemes[dayOfWeek];
  const isFeedDay = feedPostDays.includes(dayOfWeek);

  const morningTasks: ScheduleTask[] = [
    {
      key: 'morningInsight',
      time: '08:00',
      label: 'Story "Bom dia" com insight real',
      description: getContextualDescription('morningInsight', strategy.pillar, theme),
      points: 5,
      examples: getTaskExamples('morningInsight', strategy.pillar),
    },
    {
      key: 'morningPoll',
      time: '10:00',
      label: 'Story enquete rápida (Sim/Não)',
      description: getContextualDescription('morningPoll', strategy.pillar, theme),
      points: 5,
      examples: getTaskExamples('morningPoll', strategy.pillar),
    },
  ];

  const afternoonTasks: ScheduleTask[] = [
    {
      key: 'reel',
      time: '12:00',
      label: 'Postar REELS do dia',
      description: getContextualDescription('reel', strategy.pillar, theme),
      points: 20,
      examples: getTaskExamples('reel', strategy.pillar),
    },
    {
      key: 'reelEngagement',
      time: '12:30',
      label: 'Responder comentários (30 min)',
      description: getContextualDescription('reelEngagement', strategy.pillar, theme),
      points: 10,
      examples: getTaskExamples('reelEngagement', strategy.pillar),
    },
    {
      key: 'valueStories',
      time: '15:00',
      label: 'Sequência 3-5 Stories de valor',
      description: getContextualDescription('valueStories', strategy.pillar, theme),
      points: 15,
      examples: getTaskExamples('valueStories', strategy.pillar),
    },
  ];

  const nightTasks: ScheduleTask[] = [
    {
      key: 'lifestyleStory',
      time: '19:00',
      label: 'Momento "Novela" (lifestyle)',
      description: getContextualDescription('lifestyleStory', strategy.pillar, theme),
      points: 10,
      examples: getTaskExamples('lifestyleStory', strategy.pillar),
    },
  ];

  if (isFeedDay) {
    afternoonTasks.push({
      key: 'feedPost',
      time: '14:00',
      label: 'Post Feed (foto/carrossel)',
      description: getContextualDescription('feedPost', strategy.pillar, theme),
      points: 15,
      examples: getTaskExamples('feedPost', strategy.pillar),
    });
  }

  const blocks: TimeBlock[] = [
    {
      id: 'morning',
      title: 'Bloco Manhã',
      subtitle: 'Aproximação + Engajamento',
      emoji: '🌅',
      tasks: morningTasks,
    },
    {
      id: 'afternoon',
      title: 'Bloco Tarde',
      subtitle: 'Autoridade + Valor',
      emoji: '☀️',
      tasks: afternoonTasks,
    },
    {
      id: 'night',
      title: 'Bloco Noite',
      subtitle: 'Lifestyle + Conexão',
      emoji: '🌙',
      tasks: nightTasks,
    },
  ];

  const totalTasks = blocks.reduce((sum, b) => sum + b.tasks.length, 0) + 1;
  const cliffhangerOpts = getCliffhangerOptions(day);

  return {
    dayOfWeek,
    dayOfWeekName: dayOfWeekNames[dayOfWeek],
    weeklyTheme: theme,
    blocks,
    cliffhanger: cliffhangerOpts[0],
    cliffhangerOptions: cliffhangerOpts,
    isFeedDay,
    totalTasks,
  };
}
