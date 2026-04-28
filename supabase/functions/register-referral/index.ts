import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { code } = await req.json().catch(() => ({}));
    if (!code || typeof code !== "string" || code.length > 64) {
      return new Response(JSON.stringify({ ok: false, reason: "invalid_code" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: codeRow } = await admin.from("referral_codes").select("user_id, code").eq("code", code).maybeSingle();
    if (!codeRow) {
      return new Response(JSON.stringify({ ok: false, reason: "code_not_found" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (codeRow.user_id === user.id) {
      return new Response(JSON.stringify({ ok: false, reason: "self_referral" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error } = await admin.from("referrals").insert({
      referrer_id: codeRow.user_id,
      referred_user_id: user.id,
      referred_code: code,
      status: "pending",
    });

    if (error) {
      // Constraint unique(referred_user_id) — usuário já tinha sido indicado
      console.log("register-referral insert error (likely duplicate):", error.message);
      return new Response(JSON.stringify({ ok: false, reason: "already_referred" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("register-referral error:", err);
    return new Response(JSON.stringify({ ok: false, reason: "internal" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
