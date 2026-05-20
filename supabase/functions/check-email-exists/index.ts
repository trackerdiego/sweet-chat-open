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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const target = email.trim().toLowerCase();

    // Query direta em auth.users via schema('auth')
    const { data, error } = await admin
      .schema("auth" as any)
      .from("users")
      .select("id")
      .ilike("email", target)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("check-email-exists query error:", error.message);
      // Fallback: assume existe pra não travar UX.
      return new Response(
        JSON.stringify({ exists: true, fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ exists: !!data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-email-exists error:", err);
    return new Response(
      JSON.stringify({ exists: true, fallback: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
