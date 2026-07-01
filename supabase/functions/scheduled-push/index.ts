import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// 4 mensagens educativas rotativas — explicando ferramentas do app.
// Máx 2 envios/dia por user (blocos morning + evening).
// Kill switch: PUSH_PAUSED=true no .env do container `functions`.
// ============================================================

type Msg = { title: string; body: string; url: string };
type Block = 'morning' | 'evening';

const MESSAGES: Msg[] = [
  {
    title: '✅ Sua tarefa do dia tá pronta',
    body: 'Abre a aba Tarefas: 5 passos práticos personalizados pro seu nicho, feitos pra você executar em menos de 30 min.',
    url: '/tarefas',
  },
  {
    title: '💬 Pergunta o que quiser pra IA',
    body: 'Chat livre no app: tira dúvida de roteiro, ideia, edição, algoritmo — responde sobre qualquer assunto de conteúdo.',
    url: '/ferramentas',
  },
  {
    title: '🎬 Roteiro pronto em 30 segundos',
    body: 'Digita o tema, escolhe o formato (Reel, carrossel ou story) e a IA monta hook + desenvolvimento + CTA. Testa hoje.',
    url: '/script',
  },
  {
    title: '🧰 Hooks, legendas e CTAs prontos',
    body: 'Aba Ferramentas: gera hooks virais, legendas otimizadas e chamadas pra ação sob medida pro seu conteúdo.',
    url: '/ferramentas',
  },
];

// Hash estável de user_id (uuid) → inteiro pequeno.
function hashUserId(uuid: string): number {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) {
    h = ((h << 5) - h + uuid.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Índice determinístico. Alterna entre morning/evening e dia a dia,
// e desloca por user pra que ordens sejam diferentes entre usuários.
function rotationIndex(userId: string, block: Block): number {
  const daysSinceEpoch = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const blockOffset = block === 'evening' ? 1 : 0;
  return (daysSinceEpoch * 2 + blockOffset + hashUserId(userId)) % MESSAGES.length;
}

function inferBlock(): Block {
  const brHour = (new Date().getUTCHours() - 3 + 24) % 24;
  // Cutoff simples: até 15h BRT = morning, depois = evening.
  return brHour < 15 ? 'morning' : 'evening';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---------- KILL SWITCH ----------
    if ((Deno.env.get('PUSH_PAUSED') ?? '').toLowerCase() === 'true') {
      return new Response(
        JSON.stringify({ paused: true, sent: 0, message: 'PUSH_PAUSED=true — nenhum envio disparado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let block: Block;
    try {
      const body = await req.json();
      block = body.block === 'evening' || body.block === 'morning' ? body.block : inferBlock();
    } catch {
      block = inferBlock();
    }

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('user_id')
      .limit(10000);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ block, sent: 0, message: 'No subscribers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uniqueUserIds = [...new Set(subs.map((s: any) => s.user_id))];

    // Data BRT (UTC-3) usada como send_date do dedup.
    const nowBR = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayBR = nowBR.toISOString().slice(0, 10);

    let totalSent = 0;
    let skippedDedup = 0;
    let noSubs = 0;
    let sendErrors = 0;

    // Fail-safe: INSERT com ON CONFLICT DO NOTHING ANTES do envio.
    // Se a linha já existe (user já recebeu esse bloco hoje), o insert
    // não retorna e a gente pula. Mesmo com cron rodando 96×/dia, cada
    // user recebe no máximo 2 pushes/dia — garantia no nível de banco.
    for (const userId of uniqueUserIds) {
      try {
        const { data: reserved, error: reserveErr } = await supabase
          .from('push_send_log')
          .insert({ user_id: userId, send_date: todayBR, block })
          .select('user_id')
          .maybeSingle();

        if (reserveErr) {
          // Código 23505 = unique_violation → já enviado, comportamento esperado.
          if ((reserveErr as any).code === '23505') {
            skippedDedup++;
            continue;
          }
          console.error(`[scheduled-push] reserve failed for ${userId}:`, reserveErr.message);
          sendErrors++;
          continue;
        }

        if (!reserved) {
          skippedDedup++;
          continue;
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            user_id: userId,
            title: MESSAGES[rotationIndex(userId, block)].title,
            body: MESSAGES[rotationIndex(userId, block)].body,
            url: MESSAGES[rotationIndex(userId, block)].url,
          }),
        });

        const result = await response.json().catch(() => ({ sent: 0 }));
        const delivered = result.sent || 0;

        if (delivered > 0) {
          totalSent += delivered;
        } else {
          if (result.message === 'No subscriptions found') noSubs++;
          else sendErrors++;
        }
      } catch (e) {
        sendErrors++;
        console.error(`Failed for user ${userId}:`, e);
      }
    }

    console.log(
      `[scheduled-push] block=${block} users=${uniqueUserIds.length} sent=${totalSent} skipped_dedup=${skippedDedup} noSubs=${noSubs} errors=${sendErrors}`,
    );

    return new Response(
      JSON.stringify({
        block,
        users: uniqueUserIds.length,
        sent: totalSent,
        skipped_dedup: skippedDedup,
        noSubs,
        sendErrors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
