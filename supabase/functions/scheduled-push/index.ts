import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FREE_LIMITS = {
  script_generations: 3,
  tool_generations: 3,
  transcriptions: 1,
};

// ============================================================
// MENSAGENS POR SEGMENTO + BLOCO HORÁRIO
// Tons misturados: motivacional, estratégico/dica, prova social
// genérica, curiosidade/cliffhanger e CTA direto.
// ============================================================

type Msg = { title: string; body: string };
type Block = 'morning' | 'insight' | 'afternoon' | 'evening';

// ---------- PREMIUM ----------
const PREMIUM: Record<Block, ((d: number, s: number) => Msg)[]> = {
  morning: [
    (_d, s) => ({ title: '🔥 Streak de ' + s + ' dias!', body: 'Você é imparável. Bora manter esse ritmo!' }),
    (d) => ({ title: '👑 Dia ' + d + '/30 — Elite!', body: 'Poucos chegam tão longe. Seu público sente a diferença.' }),
    (d) => ({ title: '☀️ Bom dia, creator premium!', body: 'Dia ' + d + ' te espera no VyralLab. Abre e domina.' }),
    (_d, s) => ({ title: '💎 ' + s + ' dias de fogo!', body: 'Continua assim que o algoritmo recompensa consistência.' }),
    () => ({ title: '🚀 Ferramentas ilimitadas te esperam', body: 'Scripts, IA e matriz completa. Bora criar!' }),
    (d) => ({ title: '⚡ Dia ' + d + ' — sua estratégia tá pronta', body: 'Confere o plano de hoje e executa com tudo!' }),
    () => ({ title: '🌅 Manhã do creator de elite', body: '+300 criadores já abriram o app antes das 9. Bora junto?' }), // social-proof generic
    () => ({ title: '🎯 Foco da manhã', body: 'Decide AGORA o formato de hoje: Reel, story ou carrossel?' }),
    (d) => ({ title: '📅 Dia ' + d + ': sem improviso', body: 'Sua matriz pronta esperando. 2 min de leitura, 1 dia de tração.' }),
    () => ({ title: '☕ Café + estratégia', body: 'Antes do scroll, abre o VyralLab. Diferença em 30 dias é absurda.' }),
    (_d, s) => ({ title: '🏆 ' + s + ' dias direto. Isso é raro.', body: '93% dos creators desistem antes do 7º dia. Você não.' }), // social-proof generic
    () => ({ title: '⚡ Hook do dia', body: '"Você não precisa de mais conteúdo, precisa de melhor". Aplica isso hoje.' }),
  ],
  insight: [
    () => ({ title: '💡 Insight do dia', body: 'Vídeo sem comentário não vira alcance. Abre o app e pega 5 hooks novos.' }),
    () => ({ title: '🎬 Dica de storytelling', body: 'Comece pelo FIM. Mostre o resultado antes do processo. Retenção dobra.' }),
    () => ({ title: '🎯 CTA que converte', body: 'Peça UMA ação. "Salva esse post" funciona mais que "curte e compartilha".' }),
    () => ({ title: '📈 Verdade do algoritmo', body: 'Reels com >70% de retenção nos 3s iniciais têm 4x mais alcance.' }),
    () => ({ title: '🧠 Insight rápido', body: 'Hook só funciona se prometer transformação. "Aprenda X" não. "Pare de errar X" sim.' }),
    () => ({ title: '🔥 Dica de carrossel', body: 'Slide 1 = promessa. Slide 2 = problema. Slides 3-7 = passos. Último = CTA.' }),
    () => ({ title: '✨ Padrão de top creators', body: 'Eles repetem os mesmos 5 ganchos por meses. Vira assinatura. Tenta também.' }), // social-proof generic
    () => ({ title: '💬 Engajamento real', body: 'Responda os 10 primeiros comentários em <1h. O algoritmo lê isso como ouro.' }),
    () => ({ title: '🎨 Visual da semana', body: 'Texto grande, alto contraste, 1 ideia por frame. Sempre.' }),
    () => ({ title: '⚡ Atalho premium', body: 'Use o Gerador de Roteiros pra criar 3 versões e testar qual converte melhor.' }),
    () => ({ title: '🚀 Insight de viralização', body: 'Conteúdo que viraliza tem 1 emoção dominante. Decida ANTES de gravar.' }),
    () => ({ title: '📊 Métrica que importa', body: 'Salvamentos > curtidas. Mire em "isso eu volto a ver depois".' }),
  ],
  afternoon: [
    (_d, s) => ({ title: '📊 ' + s + ' dias no topo!', body: 'Check da tarde: já gravou o conteúdo de hoje?' }),
    (d) => ({ title: '🎬 Dia ' + d + ' em andamento', body: 'Ainda dá tempo de gravar algo incrível. Vai lá!' }),
    () => ({ title: '🏆 Você tem acesso total', body: 'Scripts, IA, transcrição — use tudo que é seu!' }),
    (d, s) => ({ title: '💪 Streak: ' + s + ' | Dia: ' + d, body: 'Não quebra essa sequência! Uma gravação rápida resolve.' }),
    () => ({ title: '⭐ Lembrete premium', body: 'Consistência é o que separa top creators do resto.' }),
    (d) => ({ title: '📱 Dia ' + d + '/30', body: 'Cada dia completado é um passo pro próximo nível.' }),
    () => ({ title: '🕒 Janela de ouro: 17h-21h', body: 'É quando seu público rola o feed. Posta agora pra pegar a onda.' }),
    () => ({ title: '🧪 Teste rápido', body: 'Mesmo conteúdo, 2 hooks diferentes. Veja qual fura o feed.' }),
    () => ({ title: '🔁 Repostar funciona', body: 'Pegue seu top post de 30 dias atrás e regrave com hook novo.' }),
    () => ({ title: '👀 Centenas estão criando agora', body: 'Não fica de fora. 20 minutos resolve.' }), // social-proof generic
    () => ({ title: '⚡ Hack de produtividade', body: 'Bate 3 conteúdos seguidos. Bateria de gravação rende 5x mais.' }),
    () => ({ title: '🎯 Pergunta da tarde', body: 'O que você quer que o público sinta hoje? Grava em torno disso.' }),
  ],
  evening: [
    (d, s) => ({ title: '✅ Dia ' + d + ' fechado!', body: 'Streak de ' + s + ' dias. Amanhã a gente continua!' }),
    (d) => ({ title: '🌙 Planejamento noturno', body: 'Dia ' + (d + 1) + ' amanhã. Já dá uma olhada no plano!' }),
    (_d, s) => ({ title: '💜 ' + s + ' dias consecutivos!', body: 'Você tá construindo algo grande. Descansa e volta amanhã.' }),
    () => ({ title: '👑 Boa noite, creator!', body: 'Respondeu os comentários? Planejou amanhã? Arrasou!' }),
    (d) => ({ title: '🔮 Amanhã: Dia ' + (d + 1), body: 'Estratégia nova te esperando. Descansa bem!' }),
    () => ({ title: '📝 Review do dia', body: 'Cada conteúdo postado te aproxima do seu objetivo.' }),
    () => ({ title: '🌙 Ritual noturno', body: 'Anota 1 ideia que apareceu hoje. Amanhã ela vira post.' }),
    () => ({ title: '✨ Insight pra dormir', body: 'Quem planeja a noite, posta cedo. Quem posta cedo, alcança mais.' }),
    () => ({ title: '🎬 Gravou? Agendou?', body: 'Programa o post pra 7h da manhã e descansa tranquilo.' }),
    () => ({ title: '💭 Pergunta da noite', body: 'O que seu público precisava ouvir hoje e não ouviu? Grava amanhã.' }),
    () => ({ title: '🏅 Você fez mais que ontem', body: 'Mesmo 1% a mais por dia compõe absurdamente.' }),
    () => ({ title: '😴 Boa noite!', body: 'Amanhã tem matriz nova. Confiança vem da preparação.' }),
  ],
};

// ---------- FREE_EARLY (dias 1-4) ----------
const FREE_EARLY: Record<Block, ((d: number, s: number) => Msg)[]> = {
  morning: [
    (d) => ({ title: '📱 Dia ' + d + ' da sua transformação!', body: 'Abre o app e confere o plano gratuito de hoje.' }),
    (_d, s) => ({ title: '⚡ ' + s + ' dias seguidos!', body: 'Tá criando o hábito. Não para agora!' }),
    (d) => ({ title: '☀️ Bom dia! Dia ' + d + ' te espera', body: 'Sua estratégia de hoje já tá pronta. Bora!' }),
    () => ({ title: '🎁 Suas 3 gerações grátis te esperam', body: 'Scripts, ferramentas — aproveite a cota do dia.' }),
    (d) => ({ title: '💡 Dia ' + d + ': ideia fresca!', body: 'Confere as sugestões do dia e começa a criar.' }),
    () => ({ title: '🎬 Câmera, ação!', body: 'Seu conteúdo de hoje pode ser o que muda tudo. Bora!' }),
    () => ({ title: '🌅 Comece pelo mais fácil', body: '1 story respondendo 1 dúvida. Pronto, dia destravado.' }),
    () => ({ title: '🚀 +200 creators começaram essa semana', body: 'Não fica pra trás. Abre o VyralLab.' }), // social-proof generic
    () => ({ title: '🧠 Verdade dura', body: 'Quem grava todo dia 30 dias muda de patamar. Quem espera "inspiração", não.' }),
    (d) => ({ title: '🎯 Dia ' + d + ': missão simples', body: 'Abre o app, escolhe 1 tarefa, executa. 15 minutos.' }),
  ],
  insight: [
    () => ({ title: '💡 Insight grátis do dia', body: 'Hook precisa criar tensão em 1 segundo. Se não, o dedo passa.' }),
    () => ({ title: '🎬 Dica que vale ouro', body: 'Grave em pé. Sua voz projeta melhor. Sério, testa.' }),
    () => ({ title: '🎯 CTA que ninguém usa', body: '"Me conta nos comentários X". 3x mais resposta que "comenta aí".' }),
    () => ({ title: '📈 Algoritmo simplificado', body: 'Quanto mais tempo o vídeo segura, mais ele entrega. Foca em retenção.' }),
    () => ({ title: '🔥 Hook campeão', body: '"Se você faz X e não tem Y, é por causa disso aqui." Adapta pro seu nicho.' }),
    () => ({ title: '✨ Padrão dos virais', body: 'Quase todo viral começa com promessa específica. Não vago. Específico.' }),
    () => ({ title: '🧠 Insight rápido', body: '1 vídeo por dia > 7 vídeos no domingo. Constância vence volume.' }),
    () => ({ title: '🎨 Visual', body: 'Legenda em texto grande, no centro. 70% assistem sem som.' }),
    () => ({ title: '💬 Verdade comercial', body: 'Quem não vende em conteúdo, vende em DM. Sempre tem CTA.' }),
    () => ({ title: '🚀 Mini-hack', body: 'Olha pros 5 melhores creators do seu nicho. Anota os 3 ganchos mais usados.' }),
  ],
  afternoon: [
    (d) => ({ title: '📲 Dia ' + d + ' — já gravou?', body: 'Seu futuro eu milionário tá contando com você!' }),
    (_d, s) => ({ title: '🎯 Streak: ' + s + ' dias!', body: 'Não quebra agora! Uma gravação rápida e tá feito.' }),
    () => ({ title: '⏰ Check da tarde!', body: 'Já fez pelo menos um conteúdo hoje? Ainda dá tempo!' }),
    (d) => ({ title: '🔔 Dia ' + d + ' passando...', body: 'Pega o celular, acha uma luz boa e GRAVA!' }),
    () => ({ title: '💜 Só vim lembrar', body: 'Você é capaz de coisas incríveis. Agora grava!' }),
    (d) => ({ title: '⚡ Dia ' + d + ' — guia gratuito te espera', body: 'Use sua cota diária e mantém o ritmo.' }),
    () => ({ title: '☕ Pausa estratégica', body: '5 minutos lendo a matriz vale 2 horas de "pensando o que postar".' }),
    () => ({ title: '🎬 Janela boa pra gravar: agora', body: 'Luz natural natural na tarde rende vídeo pro feed.' }),
    () => ({ title: '👀 Centenas postando agora', body: 'E você? Cada dia parado o algoritmo te esquece um pouco.' }), // social-proof generic
    () => ({ title: '⚡ Truque rápido', body: 'Reaproveita um Reel de outro creator do nicho (com sua opinião). Engaja fácil.' }),
  ],
  evening: [
    (d) => ({ title: '💬 Dia ' + d + ' quase no fim!', body: 'Responde os comentários e prepara o de amanhã.' }),
    (_d, s) => ({ title: '🎉 ' + s + ' dias de evolução!', body: 'Cada conteúdo te aproxima do objetivo. Continue!' }),
    (d) => ({ title: '🌙 Boa noite! Dia ' + (d + 1) + ' amanhã', body: 'Já dá uma olhada no plano de amanhã.' }),
    () => ({ title: '✅ Check final do dia!', body: 'Respondeu comentários? Planejou amanhã? Arrasou!' }),
    (_d, s) => ({ title: '💫 Reflexão: ' + s + ' dias firme!', body: 'Se orgulhe de cada passo. Amanhã tem mais!' }),
    () => ({ title: '💤 Descansa, creator!', body: 'Mas antes: agenda um horário pra gravar amanhã.' }),
    () => ({ title: '🌙 Insight pra dormir', body: 'Quem domina o nicho não é o melhor — é quem aparece todo dia.' }),
    () => ({ title: '📝 Anota 1 ideia agora', body: 'Antes do sono ela some. Vira post amanhã.' }),
    () => ({ title: '🎯 Compromisso de hoje', body: 'Diga em voz alta: "amanhã eu posto". Funciona.' }),
    () => ({ title: '✨ Pequeno passo', body: 'Hoje você fez mais que a maioria que só pensa em criar conteúdo.' }),
  ],
};

// ---------- FREE_TRIAL_END (dias 5-7) ----------
const FREE_TRIAL_END: Record<Block, ((d: number, remaining: number) => Msg)[]> = {
  morning: [
    (_d, r) => ({ title: '⏳ Faltam só ' + r + ' dias do seu acesso grátis!', body: 'Aproveite ao máximo antes que o dia 8 bloqueie.' }),
    () => ({ title: '🔒 Dia 8 tá chegando...', body: 'E com ele, a matriz dos dias 8-30 fica bloqueada. Garanta já!' }),
    (d) => ({ title: '💎 Dia ' + d + '/7 do plano gratuito', body: 'Você já viu o poder. Imagina os 30 completos? Desbloqueie!' }),
    (_d, r) => ({ title: '🚨 Só mais ' + r + ' dias grátis!', body: 'Depois disso, scripts e IA ficam bloqueados. Garanta acesso!' }),
    () => ({ title: '🏆 Outros creators já desbloquearam', body: 'Enquanto você pensa, eles estão usando a matriz completa.' }), // social-proof generic
    (_d, r) => ({ title: '⚡ ' + r + ' dias restantes do gratuito!', body: 'Desbloqueie agora e não perca o ritmo que você criou.' }),
    () => ({ title: '🌅 Hoje é um bom dia pra decidir', body: 'R$1,57/dia pra continuar tudo que começou. Vale.' }),
    () => ({ title: '💡 Pensa rápido', body: '30 dias de matriz = 30 dias de tração real. 7 dias é só a amostra.' }),
  ],
  insight: [
    () => ({ title: '💡 Insight + decisão', body: 'Você já provou que cria. Pena travar no dia 8 quando tá pegando ritmo.' }),
    () => ({ title: '🎯 Verdade comercial', body: 'Top creators investem em ferramenta. Resto improvisa e estaca.' }),
    () => ({ title: '📈 Conta dos 23 dias', body: 'Dias 8-30 é onde a matriz vira viralização. Você não viu ainda.' }),
    () => ({ title: '🔥 Vale 2 cafés por dia', body: 'Premium custa menos que isso e libera ilimitado.' }),
    () => ({ title: '🚀 Tendência', body: 'Quem desbloqueia agora pega 23 dias seguidos de execução guiada.' }),
    () => ({ title: '🧠 Insight grátis', body: 'A diferença entre quem cresce e quem para? Continuidade. Garanta a sua.' }),
  ],
  afternoon: [
    (_d, r) => ({ title: '🔥 Faltam ' + r + ' dias!', body: 'Você já provou que leva a sério. Hora de ir pro próximo nível!' }),
    () => ({ title: '💰 Tudo por menos de R$2/dia', body: 'Scripts ilimitados, IA completa, matriz de 30 dias.' }),
    (d) => ({ title: '📈 Dia ' + d + ' — e depois?', body: 'Creators que crescem não param no dia 7. E você?' }),
    () => ({ title: '🎯 Suas ferramentas de IA estão limitadas', body: 'No premium tudo fica ilimitado: scripts, análise, transcrição.' }),
    (_d, r) => ({ title: '⏰ Contagem regressiva: ' + r + ' dias', body: 'Garanta acesso antes que expire!' }),
    () => ({ title: '🧠 Você já tem o talento', body: 'Só falta a ferramenta certa. Desbloqueie o acesso completo.' }),
    () => ({ title: '👀 Quem segue gana', body: 'Premium = 23 dias contínuos. Free = pausa e perde tração.' }),
  ],
  evening: [
    (_d, r) => ({ title: '🔑 ' + r + ' dias pra decidir', body: 'Amanhã pode ser o dia que muda tudo. Desbloqueie!' }),
    () => ({ title: '🌟 Seu nicho tem potencial inexplorado', body: 'A matriz completa de 30 dias revela tudo. Libere o acesso.' }),
    () => ({ title: '📊 30 dias > 7 dias', body: 'Desbloqueie sua evolução e veja resultados reais.' }),
    (_d, r) => ({ title: '💡 Só mais ' + r + ' dias grátis', body: 'Quem investe em si cresce mais rápido. O plano completo te espera.' }),
    () => ({ title: '🚀 Você começou forte!', body: 'Não perca o ritmo. Os dias 8-30 são onde a mágica acontece.' }),
    () => ({ title: '✨ Seu conteúdo merece mais', body: 'Mais scripts, mais ferramentas, mais dias de estratégia.' }),
  ],
};

// ---------- FREE_LOCKED ----------
const FREE_LOCKED: Record<Block, Msg[]> = {
  morning: [
    { title: '🔒 Sua matriz dos dias 8-30 tá bloqueada', body: 'Desbloqueie e continue de onde parou.' },
    { title: '🚪 O plano gratuito terminou no dia 7', body: 'A continuação da sua jornada te espera no premium.' },
    { title: '☀️ Bom dia! Pronto pra desbloquear?', body: 'Os próximos 23 dias de estratégia tão prontos pra você.' },
    { title: '💎 Você já provou que leva a sério', body: 'Hora de continuar — desbloqueia e segue evoluindo.' },
    { title: '📅 Dias 8-30 = o pulo do gato', body: 'É onde a estratégia vira resultado. Libere o acesso.' },
    { title: '🏆 Creators de verdade não param no dia 7', body: 'Desbloqueie e veja onde isso te leva.' }, // social-proof generic
    { title: '🌅 Recomeça hoje', body: 'R$1,57/dia. Menos que um pão na chapa.' },
    { title: '🚀 +300 creators desbloquearam essa semana', body: 'Tá faltando você nessa lista.' }, // social-proof generic
  ],
  insight: [
    { title: '💡 Insight pra pensar', body: 'Você travou no melhor momento. Dia 8 é onde a tração começa.' },
    { title: '🎯 Verdade chata', body: 'Sem ferramenta, criar conteúdo vira "achismo". Premium liberta isso.' },
    { title: '📈 Cálculo simples', body: '23 dias x 4 conteúdos = 92 posts. Premium entrega tudo guiado.' },
    { title: '🔥 Hack rápido', body: 'Top creators têm sistema. Desbloqueia o seu agora.' },
    { title: '🚀 O que os pagos fazem diferente', body: 'Eles não escolhem o que postar. A matriz escolhe.' },
    { title: '🧠 Pensa nisso', body: 'Você usou 7 dias e quer mais. Isso é sinal de fit, não de "talvez".' },
  ],
  afternoon: [
    { title: '🔓 Sua estratégia de hoje tá esperando', body: 'Mas precisa do premium pra liberar. Garanta agora!' },
    { title: '💰 Menos de R$2/dia pelos 23 dias restantes', body: 'Scripts, IA e matriz completa, tudo desbloqueado.' },
    { title: '📈 Você travou no dia 7 — bora destravar?', body: 'O plano completo libera tudo de uma vez.' },
    { title: '🎯 Ferramentas de IA bloqueadas', body: 'Premium libera scripts, análise e transcrição ilimitados.' },
    { title: '🧠 O talento você já tem', body: 'Só falta a ferramenta certa. Desbloqueie o acesso completo.' },
    { title: '⏳ Cada dia parado é oportunidade perdida', body: 'Desbloqueia e volta pra sua rotina de criação.' },
    { title: '🕒 Janela de ouro hoje', body: 'Desbloqueia e ainda dá tempo de gravar antes das 19h.' },
  ],
  evening: [
    { title: '🔑 Amanhã pode ser o dia que muda tudo', body: 'Mas só com acesso completo. Desbloqueie agora!' },
    { title: '🌟 Seu nicho tem potencial inexplorado', body: 'A matriz dos dias 8-30 revela tudo. Libere o acesso.' },
    { title: '📊 Consistência de 30 dias > tentativa de 7', body: 'Desbloqueie e veja resultados reais.' },
    { title: '💡 Antes de dormir, pense', body: 'Quem investe em si cresce mais rápido. Premium te espera.' },
    { title: '🚀 Você começou forte nos 7 dias', body: 'Os dias 8-30 são onde a mágica acontece. Desbloqueie!' },
    { title: '✨ Seu conteúdo merece mais', body: 'Mais scripts, mais ferramentas, mais dias de estratégia.' },
  ],
};

// ---------- FREE_EXHAUSTED ----------
const FREE_EXHAUSTED: Record<Block, Msg[]> = {
  morning: [
    { title: '🚫 Sua cota de hoje foi usada', body: 'Premium libera scripts e ferramentas ilimitados.' },
    { title: '📅 3 gerações/dia é pouco?', body: 'No premium, sem limite. Desbloqueie sua evolução.' },
    { title: '🔓 Sua estratégia tá pronta', body: 'Mas a cota gratuita travou. Libere o acesso completo!' },
    { title: '💎 Você usa muito — isso é ótimo!', body: 'Hora de ir além dos limites do plano gratuito.' },
    { title: '🏆 Creators sérios não param na cota diária', body: 'Desbloqueie ilimitado e crie sem freio.' },
    { title: '⚡ Seu potencial tá limitado pela cota grátis', body: 'Premium = scripts ilimitados, IA completa.' },
  ],
  insight: [
    { title: '💡 Insight da cota', body: 'Quem estoura a cota grátis 3 dias seguidos é exatamente quem ganha mais com o premium.' },
    { title: '🎯 Calcula a economia', body: 'Premium custa R$1,57/dia. Você gasta mais tempo "esperando reset" que isso vale.' },
    { title: '📈 Sinal claro', body: 'Você usa tudo que tem disponível. Premium tira o teto.' },
    { title: '🔥 Verdade chata', body: 'Cota diária é freio. Desbloqueia e cria no SEU ritmo, não no do plano grátis.' },
  ],
  afternoon: [
    { title: '🔥 Você esgotou a cota gratuita de hoje', body: 'No premium, geração ilimitada. Vale cada centavo!' },
    { title: '💰 Menos de R$2/dia por uso ilimitado', body: 'Scripts, ferramentas de IA, matriz completa.' },
    { title: '📈 Quem usa demais a versão grátis', body: 'É exatamente quem mais ganha com o premium. E você?' },
    { title: '🎯 Suas ferramentas voltam só amanhã', body: 'Ou agora mesmo, se desbloquear o premium.' },
    { title: '🧠 Você já tem o talento', body: 'Só falta a ferramenta sem limite. Desbloqueie!' },
    { title: '⏳ Cada hora esperando reset é tempo perdido', body: 'Premium libera tudo agora.' },
  ],
  evening: [
    { title: '🔑 Amanhã sua cota reseta', body: 'Mas no premium, não tem cota. Desbloqueie!' },
    { title: '🌟 Você usou tudo — sinal de que tá ativo', body: 'Premium é feito pra quem cria de verdade.' },
    { title: '📊 Cota diária é freio', body: 'Desbloqueie e crie no seu ritmo, sem limite.' },
    { title: '💡 Enquanto descansa, pense', body: 'Quanto tempo você economiza com geração ilimitada?' },
    { title: '🚀 Você tá usando a ferramenta certa', body: 'Só falta o plano certo. Desbloqueie o premium.' },
    { title: '✨ Seu uso mostra que vale a pena', body: 'Premium libera tudo — scripts, IA e matriz completa.' },
  ],
};

// ---------- FREE_INACTIVE ----------
const FREE_INACTIVE: Record<Block, Msg[]> = {
  morning: [
    { title: '😢 Sentimos sua falta!', body: 'Faz dias que você não aparece. Volta pra gente?' },
    { title: '🔄 Recomeçar é corajoso', body: 'Abre o app e retoma de onde parou.' },
    { title: '☀️ Novo dia, nova chance!', body: 'Sua estratégia tá esperando. Bora voltar?' },
    { title: '💪 Não desiste agora!', body: 'Um conteúdo hoje já te coloca de volta no jogo.' },
    { title: '🌅 O algoritmo esquece rápido', body: 'Mas seu público não. Volta a criar!' },
    { title: '✨ Sabe o que falta?', body: 'Só um clique pra voltar. Abre o app!' },
    { title: '🚀 +200 voltaram essa semana', body: 'Te espera no VyralLab. Bora?' }, // social-proof generic
  ],
  insight: [
    { title: '💡 Insight pra você voltar', body: 'Quem retoma depois de uma pausa cresce mais rápido. Tem foco novo.' },
    { title: '🎯 Verdade gentil', body: 'Pausa não é fracasso. Não voltar, sim. Abre o app.' },
    { title: '📈 O algoritmo não te baniu', body: '1 post bom hoje e ele volta a entregar. Sério.' },
    { title: '🔥 Você não perdeu nada', body: 'Sua matriz tá lá, do mesmo jeito que deixou.' },
  ],
  afternoon: [
    { title: '📱 Faz tempo que você não aparece...', body: 'Seu conteúdo faz falta. Volta!' },
    { title: '🎯 Uma gravação rápida', body: 'É tudo que precisa pra retomar o ritmo. Vai lá!' },
    { title: '💜 Ei, tudo bem?', body: 'Só vim lembrar que você tem potencial. Bora criar?' },
    { title: '⚡ Reativar é mais fácil que começar do zero', body: 'Abre o app e vê seu plano.' },
    { title: '🔔 Seu público sente falta', body: 'Volta a postar e reconquiste o algoritmo!' },
    { title: '🌟 Você já sabe o caminho', body: 'Só falta dar o primeiro passo de volta.' },
  ],
  evening: [
    { title: '🌙 Antes de dormir...', body: 'Que tal planejar um conteúdo pra amanhã? Abre o app!' },
    { title: '💡 Ideia: volte amanhã!', body: 'Seu plano ainda tá lá, esperando. Bora?' },
    { title: '📝 Planeje agora, grave amanhã', body: 'Consistência começa com um plano. Abre o VyralLab!' },
    { title: '🔮 Amanhã pode ser diferente', body: 'Se você decidir agora. Abre o app e planeje!' },
    { title: '💤 Boa noite!', body: 'Mas antes: prometa que amanhã volta a criar. Deal?' },
    { title: '✅ Um passo de cada vez', body: 'Volta pro app amanhã e recomeça. Você consegue!' },
  ],
};

// ---------- NEW_USER ----------
const NEW_USER: Record<Block, Msg[]> = {
  morning: [
    { title: '👋 Bem-vindo ao VyralLab!', body: 'Abre o app e começa sua jornada de creator.' },
    { title: '☀️ Bom dia! Vamos começar?', body: 'Seu plano de 30 dias te espera. Bora!' },
    { title: '✨ Hoje é um ótimo dia pra começar', body: 'Abre o app e descobre sua estratégia.' },
    { title: '🚀 Primeiro dia, primeiro passo', body: 'Em 15 min você tem matriz pronta pros próximos 30 dias.' },
  ],
  insight: [
    { title: '💡 Pra começar bem', body: 'Defina 1 promessa central pro seu perfil. Sem isso, conteúdo não fixa.' },
    { title: '🎯 Insight de novato', body: 'Não copie influencer grande. Copie a estrutura, não o nicho.' },
    { title: '📈 Verdade do começo', body: 'Os 7 primeiros vídeos são treino. O 8º começa a entregar.' },
    { title: '🔥 Bem-vindo!', body: 'Top creators têm 1 hábito: aparecer todo dia. Bora começar.' },
  ],
  afternoon: [
    { title: '📱 Já abriu o app hoje?', body: 'Sua estratégia personalizada tá pronta.' },
    { title: '🎯 Hora de dar o primeiro passo', body: 'Abre o app e começa a criar.' },
    { title: '💜 Bem-vindo!', body: 'Vamos transformar você em creator. Abre o app!' },
  ],
  evening: [
    { title: '🌙 Antes de dormir...', body: 'Dá uma olhada no app e prepara o primeiro dia.' },
    { title: '💡 Amanhã pode ser o início', body: 'Abre o VyralLab e planeja seu primeiro conteúdo.' },
    { title: '✅ Bem-vindo!', body: 'Tudo pronto pra você começar. Te vejo no app!' },
  ],
};

// ============================================================
// HELPERS
// ============================================================

function getTimeBlock(): Block {
  const now = new Date();
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  if (brHour < 11) return 'morning';
  if (brHour < 15) return 'insight';
  if (brHour < 19) return 'afternoon';
  return 'evening';
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isAnyLimitExhausted(usage: any): boolean {
  if (!usage) return false;
  return (
    (usage.script_generations ?? 0) >= FREE_LIMITS.script_generations ||
    (usage.tool_generations ?? 0) >= FREE_LIMITS.tool_generations ||
    (usage.transcriptions ?? 0) >= FREE_LIMITS.transcriptions
  );
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

type Segment = 'PREMIUM' | 'FREE_EARLY' | 'FREE_TRIAL_END' | 'FREE_LOCKED' | 'FREE_EXHAUSTED' | 'FREE_INACTIVE' | 'NEW_USER';

function classifyUser(usage: any, progress: any): { segment: Segment; day: number; streak: number } {
  const isPremium = usage?.is_premium ?? false;
  const day = progress?.current_day ?? 1;
  const streak = progress?.streak ?? 0;

  if (isPremium) return { segment: 'PREMIUM', day, streak };
  if (!progress) return { segment: 'NEW_USER', day: 1, streak: 0 };

  const inactiveDays = daysSince(progress?.updated_at);
  if (inactiveDays > 3) return { segment: 'FREE_INACTIVE', day, streak };

  if (day > 7) return { segment: 'FREE_LOCKED', day, streak };
  if (isAnyLimitExhausted(usage)) return { segment: 'FREE_EXHAUSTED', day, streak };
  if (day >= 5 && day <= 7) return { segment: 'FREE_TRIAL_END', day, streak };

  return { segment: 'FREE_EARLY', day, streak };
}

// Fallback seguro: se um pool [segment][block] estiver vazio (ex: insight novo
// que ainda não foi populado), cai pro 'morning' do mesmo segmento.
function safePool<T>(pool: Record<Block, T[]>, block: Block): T[] {
  const arr = pool[block];
  if (arr && arr.length > 0) return arr;
  return pool.morning;
}

function getMessage(segment: Segment, block: Block, day: number, streak: number): Msg {
  const remaining = Math.max(0, 7 - day + 1);

  switch (segment) {
    case 'PREMIUM':
      return pick(safePool(PREMIUM, block))(day, streak);
    case 'FREE_EARLY':
      return pick(safePool(FREE_EARLY, block))(day, streak);
    case 'FREE_TRIAL_END':
      return pick(safePool(FREE_TRIAL_END, block))(day, remaining);
    case 'FREE_LOCKED':
      return pick(safePool(FREE_LOCKED, block));
    case 'FREE_EXHAUSTED':
      return pick(safePool(FREE_EXHAUSTED, block));
    case 'FREE_INACTIVE':
      return pick(safePool(FREE_INACTIVE, block));
    case 'NEW_USER':
      return pick(safePool(NEW_USER, block));
  }
}

function getUrl(segment: Segment): string {
  switch (segment) {
    case 'PREMIUM':
    case 'FREE_EARLY':
      return '/tasks';
    case 'FREE_TRIAL_END':
    case 'FREE_LOCKED':
    case 'FREE_EXHAUSTED':
      return '/?upgrade=true';
    case 'FREE_INACTIVE':
    case 'NEW_USER':
      return '/';
  }
}

// ============================================================
// MAIN
// ============================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let block: Block;
    try {
      const body = await req.json();
      block = body.block || getTimeBlock();
    } catch {
      block = getTimeBlock();
    }

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('user_id');

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscribers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uniqueUserIds = [...new Set(subs.map((s: any) => s.user_id))];

    const [usageRes, progressRes] = await Promise.all([
      supabase.from('user_usage')
        .select('user_id, is_premium, script_generations, tool_generations, transcriptions')
        .in('user_id', uniqueUserIds),
      supabase.from('user_progress')
        .select('user_id, current_day, streak, updated_at')
        .in('user_id', uniqueUserIds),
    ]);

    const usageMap = new Map<string, any>();
    if (usageRes.data) for (const u of usageRes.data) usageMap.set(u.user_id, u);

    const progressMap = new Map<string, any>();
    if (progressRes.data) for (const p of progressRes.data) progressMap.set(p.user_id, p);

    const nowBR = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayBR = nowBR.toISOString().slice(0, 10);

    const { data: alreadySent } = await supabase
      .from('push_send_log')
      .select('user_id')
      .eq('send_date', todayBR)
      .eq('block', block)
      .in('user_id', uniqueUserIds);

    const sentSet = new Set((alreadySent ?? []).map((r: any) => r.user_id));
    const targetUserIds = uniqueUserIds.filter((id) => !sentSet.has(id));

    let totalSent = 0;
    let skipped = sentSet.size;
    const segmentCounts: Record<Segment, number> = {
      PREMIUM: 0, FREE_EARLY: 0, FREE_TRIAL_END: 0, FREE_LOCKED: 0, FREE_EXHAUSTED: 0, FREE_INACTIVE: 0, NEW_USER: 0,
    };

    for (const userId of targetUserIds) {
      try {
        const usage = usageMap.get(userId);
        const progress = progressMap.get(userId);
        const { segment, day, streak } = classifyUser(usage, progress);

        segmentCounts[segment]++;

        const message = getMessage(segment, block, day, streak);
        const url = getUrl(segment);

        const { error: logErr } = await supabase
          .from('push_send_log')
          .insert({ user_id: userId, send_date: todayBR, block });

        if (logErr) {
          skipped++;
          continue;
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ user_id: userId, title: message.title, body: message.body, url }),
        });

        const result = await response.json();
        totalSent += result.sent || 0;
      } catch (e) {
        console.error(`Failed for user ${userId}:`, e);
      }
    }

    console.log(`[scheduled-push] Block: ${block}, Segments: ${JSON.stringify(segmentCounts)}, Sent: ${totalSent}, Skipped(dedup): ${skipped}`);

    return new Response(JSON.stringify({ block, users: uniqueUserIds.length, sent: totalSent, skipped, segments: segmentCounts }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
