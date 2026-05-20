import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string" || email.length > 320) {
      return new Response(
        JSON.stringify({ exists: false, reason: "invalid_email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // listUsers tem filter por email no GoTrue admin API
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    if (error) {
      console.error("check-email-exists listUsers error:", error.message);
      // Fallback: respondemos true pra não travar UX. Frontend mostra mensagem genérica.
      return new Response(
        JSON.stringify({ exists: true, fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // listUsers não filtra por email server-side em todas as versões; busca client-side
    const target = email.trim().toLowerCase();
    const found = (data?.users ?? []).some((u: any) => (u.email ?? "").toLowerCase() === target);

    if (found) {
      return new Response(
        JSON.stringify({ exists: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se não achou na primeira página, faz busca paginada (até 10 páginas de 1000 = 10k users)
    for (let page = 1; page <= 10; page++) {
      const { data: pageData, error: pageErr } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (pageErr) break;
      const users = pageData?.users ?? [];
      if (users.some((u: any) => (u.email ?? "").toLowerCase() === target)) {
        return new Response(
          JSON.stringify({ exists: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (users.length < 1000) break;
    }

    return new Response(
      JSON.stringify({ exists: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-email-exists error:", err);
    // Fallback seguro: assume que existe pra não travar fluxo.
    return new Response(
      JSON.stringify({ exists: true, fallback: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
