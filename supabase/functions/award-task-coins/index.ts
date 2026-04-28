import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TASK_COINS = 10;
const STREAK_BONUS = 50;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Valida user via JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'invalid auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const day = Number(body?.day);
    const taskId = String(body?.taskId ?? '').trim();
    const subTaskIndex = body?.subTaskIndex !== undefined ? Number(body.subTaskIndex) : null;

    if (!Number.isFinite(day) || day < 1 || day > 30 || !taskId) {
      return new Response(JSON.stringify({ error: 'invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role pra creditar coins
    const admin = createClient(supabaseUrl, serviceKey);

    // reference_id idempotente
    const refId = subTaskIndex !== null
      ? `day-${day}-task-${taskId}-${subTaskIndex}`
      : `day-${day}-task-${taskId}`;

    const { data: awardData, error: awardErr } = await admin.rpc('award_task_coins', {
      p_user_id: user.id,
      p_amount: TASK_COINS,
      p_reference_id: refId,
      p_type: 'task_complete',
      p_metadata: { day, taskId, subTaskIndex },
    });

    if (awardErr) {
      console.error('[award-task-coins] rpc error', awardErr);
      return new Response(JSON.stringify({ error: awardErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const awarded = awardData?.[0]?.awarded ?? 0;
    let newBalance = awardData?.[0]?.new_balance ?? 0;

    // Bônus de streak: lê user_progress.streak; se múltiplo de 7 e maior que 0,
    // tenta creditar bônus único pra esse milestone
    let streakBonusAwarded = 0;
    const { data: progress } = await admin
      .from('user_progress')
      .select('streak')
      .eq('user_id', user.id)
      .maybeSingle();

    const streak = progress?.streak ?? 0;
    if (streak > 0 && streak % 7 === 0) {
      const { data: bonusData } = await admin.rpc('award_task_coins', {
        p_user_id: user.id,
        p_amount: STREAK_BONUS,
        p_reference_id: `streak-${streak}`,
        p_type: 'streak_bonus',
        p_metadata: { streak },
      });
      streakBonusAwarded = bonusData?.[0]?.awarded ?? 0;
      if (streakBonusAwarded > 0) {
        newBalance = bonusData?.[0]?.new_balance ?? newBalance;
      }
    }

    return new Response(JSON.stringify({
      coinsAwarded: awarded,
      streakBonus: streakBonusAwarded,
      newBalance,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[award-task-coins] fatal', e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
