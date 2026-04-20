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
// ============================================================

type Msg = { title: string; body: string };
type Block = 'morning' | 'afternoon' | 'evening';

const PREMIUM: Record<Block, ((d: number, s: number) => Msg)[]> = {
  morning: [
    (d, s) => ({ title: '🔥 Streak de ' + s + ' dias!', body: 'Você é imparável. Bora manter esse ritmo!' }),
    (d) => ({ title: '👑 Dia ' + d + '/30 — Elite!', body: 'Poucos chegam tão longe. Seu público sente a diferença.' }),
    (d) => ({ title: '☀️ Bom dia, creator premium!', body: 'Dia ' + d + ' te espera. Abre o app e domina.' }),
    (d, s) => ({ title: '💎 ' + s + ' dias de fogo!', body: 'Continua assim que o algoritmo recompensa consistência.' }),
    () => ({ title: '🚀 Modo premium ativado!', body: 'Ferramentas ilimitadas + matriz completa. Bora criar!' }),
    (d) => ({ title: '⚡ Dia ' + d + ' — sua estratégia tá pronta', body: 'Confere o plano de hoje e executa com tudo!' }),
  ],
  afternoon: [
    (d, s) => ({ title: '📊 ' + s + ' dias no topo!', body: 'Check da tarde: já gravou o conteúdo de hoje?' }),
    (d) => ({ title: '🎬 Dia ' + d + ' em andamento', body: 'Ainda dá tempo de gravar algo incrível. Vai lá!' }),
    () => ({ title: '🏆 Você tem acesso total', body: 'Scripts, IA, transcrição — use tudo que é seu!' }),
    (d, s) => ({ title: '💪 Streak: ' + s + ' | Dia: ' + d, body: 'Não quebra essa sequência! Uma gravação rápida resolve.' }),
    () => ({ title: '⭐ Lembrete premium:', body: 'Consistência é o que separa top creators do resto.' }),
    (d) => ({ title: '📱 Dia ' + d + '/30', body: 'Cada dia completado é um passo pro próximo nível.' }),
  ],
  evening: [
    (d, s) => ({ title: '✅ Dia ' + d + ' fechado!', body: 'Streak de ' + s + ' dias. Amanhã a gente continua!' }),
    (d) => ({ title: '🌙 Planejamento noturno', body: 'Dia ' + (d + 1) + ' amanhã. Já dá uma olhada no plano!' }),
    (d, s) => ({ title: '💜 ' + s + ' dias consecutivos!', body: 'Você tá construindo algo grande. Descansa e volta amanhã.' }),
    () => ({ title: '👑 Boa noite, creator!', body: 'Respondeu os comentários? Planejou amanhã? Arrasou!' }),
    (d) => ({ title: '🔮 Amanhã: Dia ' + (d + 1), body: 'Estratégia nova te esperando. Descansa bem!' }),
    () => ({ title: '📝 Review do dia:', body: 'Cada conteúdo postado te aproxima do seu objetivo.' }),
  ],
};

const FREE_EARLY: Record<Block, ((d: number, s: number) => Msg)[]> = {
  morning: [
    (d) => ({ title: '📱 Dia ' + d + ' da sua transformação!', body: 'Abre o app e confere o plano de hoje.' }),
    (d, s) => ({ title: '⚡ ' + s + ' dias seguidos!', body: 'Tá criando o hábito. Não para agora!' }),
    (d) => ({ title: '☀️ Bom dia! Dia ' + d + ' te espera', body: 'Sua estratégia de hoje já tá pronta. Bora!' }),
    () => ({ title: '🌟 Acorda que o algoritmo não dorme!', body: 'Bora gravar? Hoje é dia de viralizar!' }),
    (d) => ({ title: '💡 Dia ' + d + ': ideia fresca!', body: 'Confere as sugestões do dia e começa a criar.' }),
    () => ({ title: '🎬 Câmera, ação!', body: 'Seu conteúdo de hoje pode ser o que muda tudo. Bora!' }),
  ],
  afternoon: [
    (d) => ({ title: '📲 Dia ' + d + ' — já gravou?', body: 'Seu futuro eu milionário tá contando com você!' }),
    (d, s) => ({ title: '🎯 Streak: ' + s + ' dias!', body: 'Não quebra agora! Uma gravação rápida e tá feito.' }),
    () => ({ title: '⏰ Check da tarde!', body: 'Já fez pelo menos um conteúdo hoje? Ainda dá tempo!' }),
    (d) => ({ title: '🔔 Dia ' + d + ' passando...', body: 'Pega o celular, acha uma luz boa e GRAVA!' }),
    () => ({ title: '💜 Só vim lembrar:', body: 'Você é capaz de coisas incríveis. Agora grava!' }),
    (d) => ({ title: '⚡ Dia ' + d + ' — hora de criar!', body: 'Consistência nos primeiros dias é o que faz a diferença.' }),
  ],
  evening: [
    (d) => ({ title: '💬 Dia ' + d + ' quase no fim!', body: 'Responde os comentários e prepara o de amanhã.' }),
    (d, s) => ({ title: '🎉 ' + s + ' dias de evolução!', body: 'Cada conteúdo te aproxima do objetivo. Continue!' }),
    (d) => ({ title: '🌙 Boa noite! Dia ' + (d + 1) + ' amanhã', body: 'Já dá uma olhada no plano de amanhã.' }),
    () => ({ title: '✅ Check final do dia!', body: 'Respondeu comentários? Planejou amanhã? Arrasou!' }),
    (d, s) => ({ title: '💫 Reflexão: ' + s + ' dias firme!', body: 'Se orgulhe de cada passo. Amanhã tem mais!' }),
    () => ({ title: '💤 Descansa, creator!', body: 'Mas antes: agenda um horário pra gravar amanhã.' }),
  ],
};

const FREE_TRIAL_END: Record<Block, ((d: number, remaining: number) => Msg)[]> = {
  morning: [
    (d, r) => ({ title: '⏳ Faltam só ' + r + ' dias do teste!', body: 'Aproveite ao máximo antes que expire.' }),
    () => ({ title: '🔒 Dia 8 tá chegando...', body: 'E com ele, a matriz completa fica bloqueada. Garanta já!' }),
    (d) => ({ title: '💎 Dia ' + d + '/7 do seu teste', body: 'Você já viu o poder. Imagina os 30? Desbloqueie!' }),
    (d, r) => ({ title: '🚨 Só mais ' + r + ' dias grátis!', body: 'Depois disso, scripts e IA ficam limitados. Garanta acesso!' }),
    () => ({ title: '🏆 Outros creators já desbloquearam', body: 'Enquanto você pensa, eles estão usando a matriz completa.' }),
    (d, r) => ({ title: '⚡ ' + r + ' dias restantes!', body: 'Desbloqueie agora e não perca o ritmo que você criou.' }),
  ],
  afternoon: [
    (d, r) => ({ title: '🔥 Faltam ' + r + ' dias!', body: 'Você já provou que leva a sério. Hora de ir pro próximo nível!' }),
    () => ({ title: '💰 Tudo por menos de R$2/dia', body: 'Scripts ilimitados, IA completa, matriz de 30 dias.' }),
    (d) => ({ title: '📈 Dia ' + d + ' — e depois?', body: 'Creators que crescem não param no dia 7. E você?' }),
    () => ({ title: '🎯 Suas ferramentas de IA te esperam', body: 'Scripts, análise de público, transcrição — tudo ilimitado no premium.' }),
    (d, r) => ({ title: '⏰ Contagem regressiva: ' + r + ' dias', body: 'Garanta acesso antes que expire!' }),
    () => ({ title: '🧠 Você já tem o talento', body: 'Só falta a ferramenta certa. Desbloqueie o acesso completo.' }),
  ],
  evening: [
    (d, r) => ({ title: '🔑 ' + r + ' dias pra decidir', body: 'Amanhã pode ser o dia que muda tudo. Desbloqueie!' }),
    () => ({ title: '🌟 Seu nicho tem potencial inexplorado', body: 'A matriz completa de 30 dias revela tudo. Libere o acesso.' }),
    () => ({ title: '📊 30 dias > 7 dias', body: 'Desbloqueie sua evolução e veja resultados reais.' }),
    (d, r) => ({ title: '💡 Só mais ' + r + ' dias grátis', body: 'Quem investe em si cresce mais rápido. O plano completo te espera.' }),
    () => ({ title: '🚀 Você começou forte!', body: 'Não perca o ritmo. Os dias 8-30 são onde a mágica acontece.' }),
    () => ({ title: '✨ Seu conteúdo merece mais', body: 'Mais scripts, mais ferramentas, mais dias de estratégia.' }),
  ],
};

const FREE_EXHAUSTED: Record<Block, Msg[]> = {
  morning: [
    { title: '🚫 Seus scripts acabaram', body: 'Creators premium geram ilimitado. E você?' },
    { title: '📅 7 dias passam rápido', body: '30 dias mudam uma carreira. Desbloqueie sua evolução.' },
    { title: '🔓 Sua estratégia dos dias 8-30 está pronta', body: 'Só falta você liberar. Acesse agora!' },
    { title: '💎 Você já provou que leva a sério', body: 'Hora de ir além. O próximo nível te espera.' },
    { title: '🏆 Creators de sucesso não param no dia 7', body: 'Desbloqueie os 30 dias e veja a diferença.' },
    { title: '⚡ Seu potencial está limitado', body: 'Scripts ilimitados, IA completa, matriz de 30 dias — tudo te esperando.' },
  ],
  afternoon: [
    { title: '🔥 Você já viu o poder dos primeiros 7 dias', body: 'Imagina os 30 completos? Desbloqueie agora!' },
    { title: '💰 Tudo por menos de R$2/dia', body: 'Scripts ilimitados, ferramentas de IA, matriz completa. Vale cada centavo.' },
    { title: '📈 Creators que crescem não param no dia 7', body: 'E você? Desbloqueie o plano completo.' },
    { title: '🎯 Suas ferramentas de IA estão esperando', body: 'Geração de scripts, análise de público — tudo ilimitado no premium.' },
    { title: '🧠 Você já tem o talento', body: 'Só falta a ferramenta certa. Desbloqueie o acesso completo.' },
    { title: '⏳ Cada dia sem o plano completo é oportunidade perdida', body: 'Não deixe pra depois.' },
  ],
  evening: [
    { title: '🔑 Amanhã pode ser o dia que muda tudo', body: 'Mas só se você tiver acesso completo. Desbloqueie agora!' },
    { title: '🌟 Seu nicho tem potencial inexplorado', body: 'A matriz de 30 dias revela tudo. Libere o acesso.' },
    { title: '📊 Consistência de 30 dias > tentativas de 7', body: 'Desbloqueie e veja resultados reais.' },
    { title: '💡 Enquanto você descansa, pense nisso:', body: 'Quem investe em si cresce mais rápido.' },
    { title: '🚀 Você começou forte nos primeiros 7 dias', body: 'Os dias 8-30 são onde a mágica acontece.' },
    { title: '✨ Seu conteúdo merece mais', body: 'Mais scripts, mais ferramentas, mais dias de estratégia. Desbloqueie tudo.' },
  ],
};

const FREE_INACTIVE: Record<Block, Msg[]> = {
  morning: [
    { title: '😢 Sentimos sua falta!', body: 'Seu público também. Volta pra gente?' },
    { title: '🔄 Recomeçar é corajoso', body: 'Abre o app e retoma de onde parou.' },
    { title: '☀️ Novo dia, nova chance!', body: 'Sua estratégia tá esperando. Bora voltar?' },
    { title: '💪 Não desiste agora!', body: 'Um conteúdo hoje já te coloca de volta no jogo.' },
    { title: '🌅 O algoritmo esquece rápido', body: 'Mas seu público não. Volta a criar!' },
    { title: '✨ Sabe o que falta?', body: 'Só um clique pra voltar. Abre o app!' },
  ],
  afternoon: [
    { title: '📱 Faz tempo que você não aparece...', body: 'Seu conteúdo faz falta. Volta!' },
    { title: '🎯 Uma gravação rápida', body: 'É tudo que precisa pra retomar o ritmo. Vai lá!' },
    { title: '💜 Ei, tudo bem?', body: 'Só vim lembrar que você tem potencial. Bora criar?' },
    { title: '⚡ Reativar é mais fácil do que começar do zero', body: 'Abre o app e vê seu plano.' },
    { title: '🔔 Seu público sente falta', body: 'Volta a postar e reconquiste o algoritmo!' },
    { title: '🌟 Você já sabe o caminho', body: 'Só falta dar o primeiro passo de volta.' },
  ],
  evening: [
    { title: '🌙 Antes de dormir...', body: 'Que tal planejar um conteúdo pra amanhã? Abre o app!' },
    { title: '💡 Ideia: volte amanhã!', body: 'Seu plano ainda tá lá, esperando. Bora?' },
    { title: '📝 Planeje agora, grave amanhã', body: 'Consistência começa com um plano. Abre o Influlab!' },
    { title: '🔮 Amanhã pode ser diferente', body: 'Se você decidir agora. Abre o app e planeje!' },
    { title: '💤 Boa noite!', body: 'Mas antes: prometa que amanhã volta a criar. Deal?' },
    { title: '✅ Um passo de cada vez', body: 'Volta pro app amanhã e recomeça. Você consegue!' },
  ],
};

// ============================================================
// HELPERS
// ============================================================

function getTimeBlock(): Block {
  const now = new Date();
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  if (brHour < 12) return 'morning';
  if (brHour < 18) return 'afternoon';
  return 'evening';
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isExhausted(usage: any): boolean {
  return (
    (usage.script_generations ?? 0) >= FREE_LIMITS.script_generations &&
    (usage.tool_generations ?? 0) >= FREE_LIMITS.tool_generations &&
    (usage.transcriptions ?? 0) >= FREE_LIMITS.transcriptions
  );
}

type Segment = 'PREMIUM' | 'FREE_EARLY' | 'FREE_TRIAL_END' | 'FREE_EXHAUSTED' | 'FREE_INACTIVE';

function classifyUser(usage: any, progress: any): { segment: Segment; day: number; streak: number } {
  const isPremium = usage?.is_premium ?? false;
  const day = progress?.current_day ?? 1;
  const streak = progress?.streak ?? 0;

  if (isPremium) return { segment: 'PREMIUM', day, streak };
  if (streak === 0 && day > 1) return { segment: 'FREE_INACTIVE', day, streak };
  if (usage && isExhausted(usage)) return { segment: 'FREE_EXHAUSTED', day, streak };
  if (day >= 5 && day <= 7) return { segment: 'FREE_TRIAL_END', day, streak };
  return { segment: 'FREE_EARLY', day, streak };
}

function getMessage(segment: Segment, block: Block, day: number, streak: number): Msg {
  const remaining = Math.max(0, 7 - day);

  switch (segment) {
    case 'PREMIUM':
      return pick(PREMIUM[block])(day, streak);
    case 'FREE_EARLY':
      return pick(FREE_EARLY[block])(day, streak);
    case 'FREE_TRIAL_END':
      return pick(FREE_TRIAL_END[block])(day, remaining);
    case 'FREE_EXHAUSTED':
      return pick(FREE_EXHAUSTED[block]);
    case 'FREE_INACTIVE':
      return pick(FREE_INACTIVE[block]);
  }
}

function getUrl(segment: Segment): string {
  switch (segment) {
    case 'PREMIUM':
    case 'FREE_EARLY':
      return '/tasks';
    case 'FREE_TRIAL_END':
    case 'FREE_EXHAUSTED':
      return '/?upgrade=true';
    case 'FREE_INACTIVE':
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

    // Get all subscribers
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

    // Fetch usage + progress for all users in parallel
    const [usageRes, progressRes] = await Promise.all([
      supabase.from('user_usage')
        .select('user_id, is_premium, script_generations, tool_generations, transcriptions')
        .in('user_id', uniqueUserIds),
      supabase.from('user_progress')
        .select('user_id, current_day, streak')
        .in('user_id', uniqueUserIds),
    ]);

    const usageMap = new Map<string, any>();
    if (usageRes.data) for (const u of usageRes.data) usageMap.set(u.user_id, u);

    const progressMap = new Map<string, any>();
    if (progressRes.data) for (const p of progressRes.data) progressMap.set(p.user_id, p);

    // Dedup: skip users that already received a push for this block today (BR time)
    const nowBR = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayBR = nowBR.toISOString().slice(0, 10); // YYYY-MM-DD

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
      PREMIUM: 0, FREE_EARLY: 0, FREE_TRIAL_END: 0, FREE_EXHAUSTED: 0, FREE_INACTIVE: 0,
    };

    for (const userId of targetUserIds) {
      try {
        const usage = usageMap.get(userId);
        const progress = progressMap.get(userId);
        const { segment, day, streak } = classifyUser(usage, progress);

        segmentCounts[segment]++;

        const message = getMessage(segment, block, day, streak);
        const url = getUrl(segment);

        // Reserve the slot BEFORE sending to avoid double-send if cron overlaps.
        // Unique (user_id, send_date, block) prevents races.
        const { error: logErr } = await supabase
          .from('push_send_log')
          .insert({ user_id: userId, send_date: todayBR, block });

        if (logErr) {
          // Already logged by a parallel run — skip
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