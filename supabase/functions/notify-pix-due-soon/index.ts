// Cron diário (rodar via crontab VPS, ex: 0 9 * * *).
// Varre subscription_state.next_invoice e dispara push em D-3, D-1, D-0.
// Idempotência via campo notifications_sent dentro do JSON next_invoice.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr);
  due.setUTCHours(0, 0, 0, 0);
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function brl(v: number): string {
  return v.toFixed(2).replace(".", ",");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth via cron secret
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization") ?? "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Pega só subs com next_invoice Pix não pago
  const { data: subs, error } = await admin
    .from("subscription_state")
    .select("user_id, next_invoice")
    .not("next_invoice", "is", null);

  if (error) {
    console.error("query failed:", error);
    return new Response(JSON.stringify({ error: "query failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ user_id: string; status: string; detail?: unknown }> = [];

  const D3 = [
    (v: number) => ({ title: '⏳ Sua fatura vence em 3 dias', body: `R$ ${brl(v)} via Pix. Toque pra pagar agora e garantir seu acesso.` }),
    (v: number) => ({ title: '📅 Faltam 3 dias pra renovação', body: `R$ ${brl(v)} no Pix. Resolve em 1 minuto e nem pensa mais nisso.` }),
    (v: number) => ({ title: '💜 Lembrete carinhoso', body: `Sua renovação do Vyral Lab (R$ ${brl(v)}) vence em 3 dias. Bora adiantar?` }),
  ];
  const D1 = [
    (v: number) => ({ title: '🚨 Sua fatura vence amanhã', body: `R$ ${brl(v)} via Pix. Não perca acesso ao Vyral Lab.` }),
    (v: number) => ({ title: '⏰ Última chance sem urgência', body: `R$ ${brl(v)} no Pix amanhã. Resolve hoje e dorme tranquilo.` }),
    (v: number) => ({ title: '💡 Vence amanhã!', body: `R$ ${brl(v)} mantém sua matriz, IA e scripts liberados. Toque pra pagar.` }),
  ];
  const D0 = [
    (v: number) => ({ title: '🔥 Última chamada — vence HOJE', body: `R$ ${brl(v)} via Pix. Pague agora pra continuar dentro.` }),
    (v: number) => ({ title: '⚡ Vence hoje!', body: `R$ ${brl(v)} no Pix. Depois das 23h59 acesso é pausado.` }),
    (v: number) => ({ title: '🚨 Hoje é o dia', body: `Renova agora (R$ ${brl(v)}) e não perde o ritmo que você construiu.` }),
  ];
  const DP1 = [
    (v: number) => ({ title: '😬 Sua assinatura venceu ontem', body: `Pague o Pix de R$ ${brl(v)} em segundos e recupera o acesso ao Vyral Lab.` }),
    (v: number) => ({ title: '⏸️ Acesso pausado', body: `Sua fatura de R$ ${brl(v)} venceu ontem. Toque pra regularizar agora.` }),
    (v: number) => ({ title: '🔓 Ainda dá tempo!', body: `Renovação venceu ontem (R$ ${brl(v)}). Pix expira logo — pague pra voltar.` }),
  ];
  const choose = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  for (const s of subs ?? []) {
    try {
      const inv = s.next_invoice as Record<string, any>;
      if (!inv || inv.is_paid) continue;
      if (inv.billing_type !== "PIX" && inv.billing_type !== "UNDEFINED") continue;
      if (!inv.due_date) continue;

      const days = daysUntil(inv.due_date);
      const sent = inv.notifications_sent ?? { d3: false, d1: false, d0: false, d_plus_1: false };
      const value = Number(inv.value ?? 0);

      let key: "d3" | "d1" | "d0" | "d_plus_1" | null = null;
      let title = "";
      let body = "";

      if (days === 3 && !sent.d3) {
        key = "d3";
        const m = choose(D3)(value); title = m.title; body = m.body;
      } else if (days === 1 && !sent.d1) {
        key = "d1";
        const m = choose(D1)(value); title = m.title; body = m.body;
      } else if (days === 0 && !sent.d0) {
        key = "d0";
        const m = choose(D0)(value); title = m.title; body = m.body;
      } else if (days === -1 && !sent.d_plus_1) {
        key = "d_plus_1";
        const m = choose(DP1)(value); title = m.title; body = m.body;
      }



      if (!key) {
        results.push({ user_id: s.user_id, status: `skip_no_window_days_${days}` });
        continue;
      }

      // Dispara push
      const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          user_id: s.user_id,
          title,
          body,
          url: "/renovar",
        }),
      });

      if (!pushRes.ok) {
        const err = await pushRes.text();
        results.push({ user_id: s.user_id, status: "push_failed", detail: err });
        continue;
      }

      // Marca como enviado
      const updatedInv = {
        ...inv,
        notifications_sent: { ...sent, [key]: true },
        updated_at: new Date().toISOString(),
      };
      await admin.from("subscription_state")
        .update({ next_invoice: updatedInv, updated_at: new Date().toISOString() })
        .eq("user_id", s.user_id);

      results.push({ user_id: s.user_id, status: `sent_${key}`, detail: { days, value } });
    } catch (err) {
      console.error("loop error:", err);
      results.push({ user_id: s.user_id as string, status: "error", detail: String(err) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
