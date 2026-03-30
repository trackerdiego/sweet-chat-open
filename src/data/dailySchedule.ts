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
      '"Vocês sabiam que dormir de bruços acelera rugas? Mudei de posição e fez diferença!"',
      '"Dica matinal: lavar o rosto com água gelada reduz inchaço em 2 minutos"',
    ],
    morningPoll: [
      '"Vocês lavam o rosto de manhã? 🧼 Sim, sempre / Só água"',
      '"Protetor solar com cor ou sem cor? ☀️ Com cor / Sem cor"',
      '"Vocês reutilizam esponjinha de make? 💄 Sim / Nunca"',
      '"Skincare de manhã: rápido ou completo? ⏰ 2 min / 10 min ritual"',
      '"Make no dia a dia: sim ou pele limpa? 💅 Make leve / Pele livre"',
    ],
    reel: [
      'Tutorial: "3 passos pra uma pele glow em 5 minutos"',
      'Antes e depois: aplicação de base com técnicas diferentes',
      'Reels comparando dupes vs. produtos caros — qual realmente funciona?',
      '"Minha evolução de pele em 6 meses fazendo skincare certo"',
      'Tutorial de contorno natural que qualquer pessoa consegue fazer',
    ],
    reelEngagement: [
      'Pergunte: "Qual produto vocês querem que eu teste próximo?"',
      'Desafie: "Postem a rotina de skincare de vocês nos stories!"',
      'Crie caixinha: "Manda foto do seu necessaire que eu analiso"',
      'Responda dúvidas: "Respondi as 5 perguntas mais pedidas sobre acne"',
      'Reposte: escolha 3 seguidores que mandaram resultados de skincare',
    ],
    valueStories: [
      'Dica: como aplicar corretivo sem craquelar',
      'Passo a passo do contorno natural pro dia a dia',
      'Os 3 erros que fazem a base oxidar durante o dia',
      'Como escolher o tom certo de base online sem errar',
      'Ordem certa de aplicação de skincare (muita gente faz errado)',
    ],
    lifestyleStory: [
      'Rotina de skincare noturna com música relaxante',
      'Momento self-care: máscara facial + chá + série',
      'Testando aquele produto que vocês pediram — reação ao vivo',
      'Organizando minha penteadeira e jogando fora vencidos',
      'Ritual de domingo: esfoliação + hidratação + autocuidado',
    ],
    feedPost: [
      'Carrossel: "5 erros de skincare que todo mundo comete"',
      'Flat-lay dos produtos do mês com mini review',
      'Antes e depois de 30 dias usando um único produto',
      'Post: "O guia definitivo de protetor solar — tudo que vocês precisam saber"',
      'Carrossel: "Produtos baratinhos que funcionam MELHOR que os caros"',
    ],
  },
  fitness: {
    morningInsight: [
      '"Bom dia! Sabia que 20 min de treino consistente vale mais que 2h esporádicas?"',
      '"Acordei às 5h pra treinar. Não é sobre motivação, é sobre rotina"',
      '"Dica matinal: beber água antes do treino melhora performance em até 25%"',
      '"Hoje completei 100 dias treinando sem falhar. O segredo? Nunca depender da motivação"',
      '"Vocês sabiam que alongar de manhã reduz lesões em 40%? Eu não sabia até sofrer uma"',
    ],
    morningPoll: [
      '"Vocês treinam em jejum? 🏋️ Sim / Nunca"',
      '"Cardio antes ou depois da musculação? 🏃 Antes / Depois"',
      '"Quantas vezes por semana vocês treinam? 💪 3x / 5x+"',
      '"Treino sozinho ou com parceiro? 🤝 Sozinho / Acompanhado"',
      '"Suplemento: necessário ou desnecessário? 💊 Uso / Não uso"',
    ],
    reel: [
      'Treino completo de 10 minutos sem equipamento',
      'Evolução corporal: 30 dias de transformação',
      '"5 exercícios que substituem a academia inteira"',
      'Reagindo ao meu treino de 1 ano atrás vs. hoje',
      'Receita de pré-treino natural que dá mais energia que suplemento',
    ],
    reelEngagement: [
      'Desafie: "Quem topa fazer esse treino comigo? Postem o vídeo!"',
      'Pergunte: "Qual grupo muscular vocês mais negligenciam?"',
      'Caixinha: "Manda sua dieta que eu dou uma dica de melhoria"',
      'Responda: "As 5 perguntas mais comuns sobre emagrecimento"',
      'Reposte resultados de seguidores que seguiram seu treino',
    ],
    valueStories: [
      'Série de exercícios para iniciantes em casa',
      'O que comer antes e depois do treino',
      '3 erros que travam seu ganho de massa muscular',
      'Como montar um treino eficiente em 30 minutos',
      'Mitos de academia que ainda enganam muita gente',
    ],
    lifestyleStory: [
      'Jantar saudável: preparando a marmita de amanhã',
      'Dia de descanso: o que faço pra recuperar o corpo',
      'Compras no mercado: o que coloco no carrinho e por quê',
      'Momento relax pós-treino: banho gelado + alongamento',
      'Cozinhando uma receita fit que parece junk food',
    ],
    feedPost: [
      'Foto de treino com dicas na legenda',
      'Carrossel: "5 exercícios que todo iniciante deveria fazer"',
      'Post antes/depois com a história por trás da transformação',
      'Infográfico: "O prato ideal pra quem treina"',
      'Carrossel: "Erros que te impedem de emagrecer mesmo treinando"',
    ],
  },
  'vida-real': {
    morningInsight: [
      '"Bom dia! Hoje acordei pensando: por que a gente se cobra tanto?"',
      '"Sabe aquele dia que você acorda sem vontade de nada? Hoje é esse dia. E tá tudo bem"',
      '"Acordei às 6h, olhei pro teto e pensei: cadê aquela versão de mim que era destemida?"',
      '"Nem todo dia precisa ser produtivo. Às vezes só existir já é muito"',
      '"Reflexão matinal: o que eu faria diferente se ninguém estivesse olhando?"',
    ],
    morningPoll: [
      '"Como vocês acordaram hoje? 😴 Bem / Precisava de mais 2h"',
      '"Vocês também fingem que tá tudo bem? 🫠 Às vezes / Sempre"',
      '"Primeira coisa que fazem ao acordar: celular ou água? 📱💧"',
      '"Vocês se sentem sozinhos mesmo rodeados de gente? 🫶 Sim / Não"',
      '"Quantas vezes vocês desistiram de algo esse mês? 😶 Várias / Nenhuma"',
    ],
    reel: [
      'Storytelling: "O dia que quase desisti de tudo"',
      '"3 coisas que ninguém me contou sobre crescer"',
      'POV: quando você percebe que estava se sabotando o tempo todo',
      'A conversa mais difícil que já tive comigo mesmo',
      '"O preço de parecer forte o tempo todo" — desabafo real',
    ],
    reelEngagement: [
      'Pergunte: "Vocês também passam por isso? Contem nos comentários"',
      'Caixinha: "Me conta algo que você nunca contou pra ninguém"',
      'Reposte mensagens de seguidores que se identificaram',
      'Responda: "As mensagens mais fortes que recebi essa semana"',
      'Pergunte: "Se pudessem voltar no tempo, o que diriam pro eu de 5 anos atrás?"',
    ],
    valueStories: [
      'Dica de organização pessoal que mudou sua rotina',
      '3 hábitos simples que melhoraram minha saúde mental',
      'Como parei de me comparar com os outros (processo real)',
      'O que faço quando a ansiedade bate forte',
      'Livro/podcast que mudou minha forma de pensar',
    ],
    lifestyleStory: [
      'Jantar em casa: cozinhando algo gostoso',
      'Momento de silêncio: ritual noturno sem celular',
      'Ligando pra alguém que faz tempo que não falo',
      'Passeio sem destino: andando pela cidade pensando na vida',
      'Arrumando a casa e a cabeça ao mesmo tempo',
    ],
    feedPost: [
      'Foto real com legenda profunda sobre o momento de vida',
      'Carrossel: "5 verdades que ninguém quer ouvir sobre crescimento"',
      'Post sem filtro: foto crua + texto vulnerável',
      'Carrossel: "Frases que eu precisava ouvir essa semana"',
      'Foto antiga vs. hoje + reflexão sobre evolução pessoal',
    ],
  },
  negocios: {
    morningInsight: [
      '"Bom dia! O maior ativo do seu negócio não é o produto, é a confiança"',
      '"Acordei pensando: 80% das pessoas desistem antes do resultado aparecer"',
      '"Dica matinal: o segredo não é trabalhar mais, é trabalhar no que importa"',
      '"Hoje faz 1 ano que tomei a decisão mais arriscada da minha carreira. Valeu cada segundo"',
      '"Vocês sabiam que 90% dos negócios falham por falta de consistência, não de ideia?"',
    ],
    morningPoll: [
      '"Vocês trabalham no fim de semana? 💼 Sim / Descanso sagrado"',
      '"Renda fixa ou empreender? 💰 CLT / Próprio negócio"',
      '"Quanto tempo vocês dedicam ao planejamento? ⏰ Todo dia / Quase nunca"',
      '"Vocês investem em curso ou aprendem sozinhos? 📚 Cursos / Autodidata"',
      '"Maior medo: falir ou ficar estagnado? 😰 Falir / Estagnar"',
    ],
    reel: [
      '"3 dicas que aumentaram meu faturamento em 30 dias"',
      'Bastidores: um dia real na vida de quem empreende',
      '"O erro de R$10 mil que me ensinou mais que qualquer curso"',
      'Como validar uma ideia de negócio em 48 horas',
      '"5 ferramentas grátis que uso no meu negócio todo dia"',
    ],
    reelEngagement: [
      'Pergunte: "Qual o maior desafio do seu negócio hoje?"',
      'Caixinha: "Me conta seu negócio que eu dou 1 dica gratuita"',
      'Desafie: "Implemente 1 dessas dicas e me conta o resultado em 7 dias"',
      'Responda: "As dúvidas mais comuns de quem tá começando"',
      'Reposte resultados de seguidores que aplicaram suas dicas',
    ],
    valueStories: [
      'Dica de produtividade que mudou seu dia',
      'Como organizo minha semana pra render o dobro',
      '3 métricas que todo negócio deveria acompanhar',
      'O funil de vendas simplificado que funciona pra qualquer nicho',
      'Ferramenta gratuita que substituiu uma paga e funciona melhor',
    ],
    lifestyleStory: [
      'Momento de descanso merecido após um dia produtivo',
      'Jantar fora celebrando uma meta batida',
      'O lado que ninguém mostra: cansaço e solidão de empreender',
      'Ritual noturno: como desligo do trabalho pra dormir em paz',
      'Viagem de recompensa: mostrando os frutos do trabalho duro',
    ],
    feedPost: [
      'Carrossel: "5 lições de negócios que ninguém ensina"',
      'Post com prova social: depoimento de cliente real',
      'Infográfico: "O caminho do zero ao primeiro cliente"',
      'Carrossel: "Erros que te fazem perder dinheiro sem perceber"',
      'Post motivacional com dados reais do seu negócio',
    ],
  },
  lifestyle: {
    morningInsight: [
      '"Bom dia! Hoje resolvi que vou fazer pelo menos UMA coisa que me faz feliz"',
      '"Acordei com gratidão hoje. Às vezes a gente esquece de agradecer o básico"',
      '"Dica matinal: 5 minutos de silêncio antes de pegar o celular muda o dia inteiro"',
      '"Hoje percebi que a vida acontece nos detalhes que a gente ignora correndo"',
      '"Vocês já pararam pra perceber como o café da manhã em paz muda tudo?"',
    ],
    morningPoll: [
      '"Vocês têm rotina matinal? ☀️ Sim / Caos total"',
      '"Café ou chá de manhã? ☕ Café / Chá"',
      '"Acordar cedo ou dormir tarde? 🌙 Cedo / Tarde"',
      '"Planejam o dia ou deixam rolar? 📋 Planejo / Flow"',
      '"Vocês meditam? 🧘 Sim / Queria começar"',
    ],
    reel: [
      'Rotina matinal aesthetic em 30 segundos',
      '"Um dia na minha vida" — versão real e sem filtro',
      'Tour pela casa: cantinhos favoritos e como decorei gastando pouco',
      'Receita fácil e bonita pra um jantar especial',
      '"5 hábitos simples que mudaram minha qualidade de vida"',
    ],
    reelEngagement: [
      'Pergunte: "Qual item vocês não vivem sem na rotina?"',
      'Caixinha: "Me mandem a rotina de vocês que eu dou dicas"',
      'Desafie: "1 semana sem celular antes de dormir — quem topa?"',
      'Responda: "Os pedidos mais frequentes de vocês"',
      'Reposte: cantinhos dos seguidores inspirados no seu conteúdo',
    ],
    valueStories: [
      'Dica de organização que transformou sua rotina',
      'Produtos favoritos do mês com mini review',
      '3 apps que uso todo dia pra me organizar melhor',
      'Como criei um espaço de paz dentro de casa',
      'Hábito noturno que melhorou meu sono em 1 semana',
    ],
    lifestyleStory: [
      'Rotina noturna relaxante com skincare',
      'Preparando o jantar com receita nova e música boa',
      'Momento leitura: o livro que estou lendo e por quê',
      'Organizando a semana no domingo à noite',
      'Self-care total: banho demorado + vela + playlist chill',
    ],
    feedPost: [
      'Flat-lay aesthetic dos favoritos do mês',
      'Carrossel: "5 mudanças pequenas que transformaram minha rotina"',
      'Foto de um momento especial com legenda reflexiva',
      'Post: "Guia de autocuidado pra semana toda"',
      'Carrossel: "Cantinhos da minha casa que me fazem feliz"',
    ],
  },
  principal: {
    morningInsight: [
      '"Bom dia! Hoje quero compartilhar algo que aprendi recentemente no meu nicho"',
      '"Acordei com uma ideia que pode mudar como vocês veem [tema do nicho]"',
      '"Reflexão matinal: o que separa quem tem resultado de quem não tem no [nicho]?"',
      '"Sabia que a maioria das pessoas comete esse erro no [nicho]? Hoje vou explicar"',
      '"Dica rápida de manhã: o que eu faria diferente se estivesse começando hoje no [nicho]"',
    ],
    morningPoll: [
      '"Vocês preferem conteúdo educativo ou motivacional? 📚 Educativo / Motivacional"',
      '"Qual maior dificuldade de vocês no [nicho]? 🤔 Começar / Manter consistência"',
      '"Vocês consomem conteúdo sobre [nicho] todo dia? 📱 Sim / Quando lembro"',
      '"Vocês aplicam o que aprendem ou só consomem? 🎯 Aplico / Preciso melhorar"',
      '"O que vocês mais querem aprender sobre [nicho]? 💡 Básico / Avançado"',
    ],
    reel: [
      'Dica rápida de autoridade: "Você sabia que..."',
      '"3 mitos sobre [nicho] que todo mundo acredita"',
      'Tutorial prático: como resolver [problema comum do nicho] em 3 passos',
      'Reação a trends do nicho — concordo ou discordo?',
      '"O erro nº1 que iniciantes cometem no [nicho] — e como evitar"',
    ],
    reelEngagement: [
      'Pergunte: "Qual a maior dúvida de vocês sobre [nicho]?"',
      'Caixinha: "Manda sua situação que eu ajudo com 1 dica"',
      'Desafie: "Apliquem essa dica por 7 dias e me contem o resultado"',
      'Responda os 5 comentários mais frequentes do último vídeo',
      'Reposte resultados de seguidores que seguiram suas dicas',
    ],
    valueStories: [
      'Dica prática aplicável do seu nicho',
      'Erro comum que a maioria comete e como corrigir',
      'Ferramenta ou recurso gratuito que ajuda no [nicho]',
      'Mini tutorial em 3 stories: passo a passo simples',
      'Mito vs. verdade sobre [tema do nicho]',
    ],
    lifestyleStory: [
      'Bastidores da sua vida fora do trabalho',
      'Momento de descanso: o que faz pra recarregar',
      'Hobby ou interesse que ninguém sabe que você tem',
      'Jantar especial ou momento com família/amigos',
      'Reflexão noturna: o que aprendeu hoje',
    ],
    feedPost: [
      'Carrossel educativo: "5 dicas essenciais sobre [nicho]"',
      'Post com depoimento ou resultado de seguidor',
      'Infográfico simplificado sobre um tema complexo do nicho',
      'Foto autêntica + legenda contando uma história do nicho',
      'Carrossel: "Do zero ao resultado — o caminho que funcionou pra mim"',
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
