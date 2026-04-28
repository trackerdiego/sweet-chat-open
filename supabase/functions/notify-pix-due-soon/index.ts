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

  for (const s of subs ?? []) {
    try {
      const inv = s.next_invoice as Record<string, any>;
      if (!inv || inv.is_paid) continue;
      if (inv.billing_type !== "PIX" && inv.billing_type !== "UNDEFINED") continue;
      if (!inv.due_date) continue;

      const days = daysUntil(inv.due_date);
      const sent = inv.notifications_sent ?? { d3: false, d1: false, d0: false };
      const value = Number(inv.value ?? 0);

      let key: "d3" | "d1" | "d0" | null = null;
      let title = "";
      let body = "";

      if (days === 3 && !sent.d3) {
        key = "d3";
        title = "Sua fatura vence em 3 dias";
        body = `R$ ${brl(value)} via Pix. Toque pra pagar agora e garantir seu acesso.`;
      } else if (days === 1 && !sent.d1) {
        key = "d1";
        title = "Sua fatura vence amanhã";
        body = `R$ ${brl(value)} via Pix. Não perca acesso ao InfluLab.`;
      } else if (days <= 0 && !sent.d0) {
        key = "d0";
        title = "Última chamada — sua assinatura vence hoje";
        body = `R$ ${brl(value)} via Pix. Pague agora pra continuar dentro.`;
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
