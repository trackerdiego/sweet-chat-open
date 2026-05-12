/**
 * Catálogo de tutoriais em vídeo.
 *
 * Hospedagem: Wistia.
 *
 * Quando um vídeo for gravado e subido no Wistia, troque `wistiaId: null`
 * pelo ID do vídeo (ex: `'abc123xyz4'`). Enquanto for `null`, a UI mostra
 * um card "em produção" no lugar do player.
 *
 * O `topic` é também o ID da âncora usada em `/ajuda#<topic>` e o valor
 * passado para o componente <HelpButton topic="..." />.
 */
export type TutorialTopic = 'onboarding' | 'matriz' | 'scripts' | 'tools' | 'tarefas';

export interface Tutorial {
  topic: TutorialTopic;
  wistiaId: string | null;
  title: string;
  description: string;
  duration: string; // human-readable (ex: "2 min")
  thumbnailUrl?: string;
}

export const TUTORIALS: Tutorial[] = [
  {
    topic: 'onboarding',
    wistiaId: null,
    title: 'Configurando seu perfil',
    description: 'Como preencher seu nicho, descrição e objetivos para a IA gerar uma estratégia certeira.',
    duration: '2 min',
  },
  {
    topic: 'matriz',
    wistiaId: null,
    title: 'Sua matriz estratégica de 30 dias',
    description: 'Entenda como sua matriz é montada, como navegar pelos pilares e desbloquear cada dia.',
    duration: '3 min',
  },
  {
    topic: 'scripts',
    wistiaId: null,
    title: 'Gerando roteiros com IA',
    description: 'Como transformar a estratégia do dia em um roteiro pronto para gravar.',
    duration: '2 min',
  },
  {
    topic: 'tools',
    wistiaId: null,
    title: 'Ferramentas IA',
    description: 'Hooks, CTAs, storytelling, análise visceral e transcrição — quando usar cada uma.',
    duration: '3 min',
  },
  {
    topic: 'tarefas',
    wistiaId: null,
    title: 'Tarefas diárias e coins',
    description: 'Como funciona seu checklist diário e como cada tarefa vira desconto na assinatura.',
    duration: '2 min',
  },
];

export function getTutorial(topic: TutorialTopic): Tutorial | undefined {
  return TUTORIALS.find((t) => t.topic === topic);
}
