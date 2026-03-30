import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "agentevendeagente@gmail.com";

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

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const [usageRes, profilesRes, logsRes, authUsersRes] = await Promise.all([
      admin.from("user_usage").select("*"),
      admin.from("user_profiles").select("user_id, display_name, primary_niche, onboarding_completed"),
      admin.from("usage_logs").select("*").order("created_at", { ascending: false }).limit(500),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const usages = usageRes.data || [];
    const profiles = profilesRes.data || [];
    const logs = logsRes.data || [];
    const authUsers = authUsersRes.data?.users || [];

    const emailMap: Record<string, string> = {};
    authUsers.forEach((u: any) => { emailMap[u.id] = u.email || ""; });

    const users = profiles.map((p: any) => {
      const u = usages.find((u: any) => u.user_id === p.user_id) || {};
      return {
        user_id: p.user_id,
        display_name: p.display_name,
        email: emailMap[p.user_id] || "",
        primary_niche: p.primary_niche,
        is_premium: (u as any).is_premium ?? false,
        script_generations: (u as any).script_generations ?? 0,
        tool_generations: (u as any).tool_generations ?? 0,
        transcriptions: (u as any).transcriptions ?? 0,
        chat_messages: (u as any).chat_messages ?? 0,
        last_script_date: (u as any).last_script_date,
      };
    });

    const totalUsers = users.length;
    const premiumUsers = users.filter((u: any) => u.is_premium).length;
    const freeUsers = totalUsers - premiumUsers;

    const totalScripts = users.reduce((s: number, u: any) => s + u.script_generations, 0);
    const totalTools = users.reduce((s: number, u: any) => s + u.tool_generations, 0);
    const totalTranscriptions = users.reduce((s: number, u: any) => s + u.transcriptions, 0);
    const totalChat = users.reduce((s: number, u: any) => s + u.chat_messages, 0);

    return new Response(JSON.stringify({
      metrics: { totalUsers, premiumUsers, freeUsers, totalScripts, totalTools, totalTranscriptions, totalChat },
      users,
      recentLogs: logs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-dashboard error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
