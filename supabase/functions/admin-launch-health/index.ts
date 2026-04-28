import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "agentevendeagente@gmail.com";

// Cache simples in-memory pra reduzir carga em refresh de 30s.
let cache: { data: unknown; ts: number } | null = null;
const CACHE_MS = 10_000;

function startOfDayISO(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user || user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache hit
    if (cache && Date.now() - cache.ts < CACHE_MS) {
      return new Response(JSON.stringify(cache.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "x-cache": "hit" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey) as any;

    const todayISO = startOfDayISO();
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const next3d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const [
      subsRes,
      newPayingTodayRes,
      trialEndingRes,
      webhookEventsRes,
      orphansRes,
      aiJobs24hRes,
      recentAiFailuresRes,
      onboardingRunsRes,
    ] = await Promise.all([
      // MRR & status — só pagantes reais (excluímos os 4 premium manuais sem asaas_customer_id)
      admin.from("subscription_state")
        .select("user_id,status,plan,current_period_end,asaas_customer_id,updated_at")
        .not("asaas_customer_id", "is", null),
      // Novos pagantes hoje
      admin.from("subscription_state")
        .select("user_id", { count: "exact", head: true })
        .eq("status", "active")
        .not("asaas_customer_id", "is", null)
        .gte("updated_at", todayISO),
      // Trials acabando em 3 dias
      admin.from("subscription_state")
        .select("user_id,trial_ends_at,plan")
        .eq("status", "trial")
        .lte("trial_ends_at", next3d)
        .gte("trial_ends_at", new Date().toISOString())
        .order("trial_ends_at", { ascending: true })
        .limit(50),
      // Últimos 50 eventos de webhook
      admin.from("asaas_webhook_events")
        .select("id,event_id,event_type,user_id,received_at,processed_at,processing_error,payload")
        .order("received_at", { ascending: false })
        .limit(50),
      // Órfãos (sem user_id resolvido) últimos 7 dias
      admin.from("asaas_webhook_events")
        .select("id,event_id,event_type,received_at,processing_error,payload")
        .is("user_id", null)
        .gte("received_at", last7d)
        .order("received_at", { ascending: false })
        .limit(50),
      // AI jobs últimas 24h
      admin.from("ai_jobs")
        .select("status,job_type,started_at,completed_at")
        .gte("created_at", last24h),
      // Falhas recentes detalhadas
      admin.from("ai_jobs")
        .select("id,job_type,status,error_message,created_at,user_id")
        .eq("status", "failed")
        .gte("created_at", last7d)
        .order("created_at", { ascending: false })
        .limit(20),
      // Onboarding runs últimos 7 dias
      admin.from("onboarding_runs")
        .select("status,current_stage,created_at,completed_at")
        .gte("created_at", last7d),
    ]);

    // ==================== MRR ====================
    const subs = (subsRes.data || []) as Array<any>;
    const activePayers = subs.filter(s => s.status === "active");
    const trialing = subs.filter(s => s.status === "trial");
    const churned = subs.filter(s => ["canceled", "expired", "past_due"].includes(s.status));

    let mrrCents = 0;
    activePayers.forEach(s => {
      if (s.plan === "monthly") mrrCents += 4700;
      else if (s.plan === "yearly") mrrCents += Math.round(29700 / 12);
    });

    const churnLast30 = subs.filter(s =>
      ["canceled", "expired"].includes(s.status) &&
      s.updated_at && new Date(s.updated_at) > new Date(Date.now() - 30 * 86400000)
    ).length;
    const churnRate = activePayers.length > 0
      ? (churnLast30 / (activePayers.length + churnLast30)) * 100
      : 0;

    // ==================== Webhooks ====================
    const events = (webhookEventsRes.data || []) as Array<any>;
    const failedEvents = events.filter(e => e.processing_error);
    const orphans = (orphansRes.data || []) as Array<any>;

    // ==================== AI Jobs ====================
    const jobs = (aiJobs24hRes.data || []) as Array<any>;
    const completed = jobs.filter(j => j.status === "completed");
    const failed = jobs.filter(j => j.status === "failed");
    const successRate = jobs.length > 0 ? (completed.length / jobs.length) * 100 : 100;

    const latencies = completed
      .filter(j => j.started_at && j.completed_at)
      .map(j => new Date(j.completed_at).getTime() - new Date(j.started_at).getTime());
    const avgLatencyMs = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    const byType: Record<string, { total: number; failed: number }> = {};
    jobs.forEach(j => {
      byType[j.job_type] = byType[j.job_type] || { total: 0, failed: 0 };
      byType[j.job_type].total++;
      if (j.status === "failed") byType[j.job_type].failed++;
    });

    // ==================== Onboarding ====================
    const runs = (onboardingRunsRes.data || []) as Array<any>;
    const completedRuns = runs.filter(r => r.status === "completed");
    const failedRuns = runs.filter(r => r.status === "failed");
    const runningRuns = runs.filter(r => ["pending", "running"].includes(r.status));
    const completionRate = runs.length > 0 ? (completedRuns.length / runs.length) * 100 : 0;

    const dropOffByStage: Record<number, number> = {};
    failedRuns.forEach(r => {
      dropOffByStage[r.current_stage || 0] = (dropOffByStage[r.current_stage || 0] || 0) + 1;
    });

    const result = {
      generated_at: new Date().toISOString(),
      mrr: {
        active_payers: activePayers.length,
        trialing: trialing.length,
        churned_total: churned.length,
        churn_30d: churnLast30,
        churn_rate_pct: Number(churnRate.toFixed(2)),
        mrr_brl: Number((mrrCents / 100).toFixed(2)),
        new_paying_today: newPayingTodayRes.count || 0,
        trial_ending_soon: (trialEndingRes.data || []).length,
        trial_ending_list: trialEndingRes.data || [],
      },
      webhooks: {
        recent: events,
        failed_count: failedEvents.length,
        orphan_count: orphans.length,
        orphans,
      },
      ai_jobs: {
        total_24h: jobs.length,
        completed_24h: completed.length,
        failed_24h: failed.length,
        success_rate_pct: Number(successRate.toFixed(2)),
        avg_latency_ms: Math.round(avgLatencyMs),
        by_type: byType,
        recent_failures: recentAiFailuresRes.data || [],
      },
      onboarding: {
        total_7d: runs.length,
        completed_7d: completedRuns.length,
        failed_7d: failedRuns.length,
        running: runningRuns.length,
        completion_rate_pct: Number(completionRate.toFixed(2)),
        drop_off_by_stage: dropOffByStage,
      },
    };

    cache = { data: result, ts: Date.now() };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "x-cache": "miss" },
    });
  } catch (e) {
    console.error("admin-launch-health error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
