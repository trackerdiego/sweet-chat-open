import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiNative, GeminiError } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

console.log("[generate-script] boot — using native endpoint, responseSchema");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let userId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Não autorizado" }, 401);

    const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Não autorizado" }, 401);
    userId = user.id;

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const t0 = Date.now();
    const [usageRes, audienceRes] = await Promise.all([
      adminClient.from("user_usage").select("is_premium, script_generations, last_script_date").eq("user_id", userId).maybeSingle(),
      supabaseAuth.from("audience_profiles").select("avatar_profile").eq("user_id", userId).maybeSingle(),
    ]);
    const usageData = usageRes.data;
    const audienceData = audienceRes.data;
    console.log("[generate-script] db parallel fetch", { userId, ms: Date.now() - t0 });

    const isPremium = usageData?.is_premium ?? false;
    const today = new Date().toISOString().slice(0, 10);
    const isNewDay = usageData?.last_script_date !== today;
    const scriptCount = isNewDay ? 0 : (usageData?.script_generations ?? 0);

    if (!isPremium && scriptCount >= 3) {
      return jsonResponse({ error: "Você atingiu o limite de 3 scripts por dia. Assine o plano premium para uso ilimitado." }, 429);
    }

    const { day, title, pillar, pillarLabel, viralHook, storytellingBody, subtleConversion, primaryNiche, contentStyle, visceralElement } = await req.json();
    console.log("[generate-script] start", { userId, day, pillar, isPremium, scriptCount });

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) {
      console.error("[generate-script] missing GOOGLE_GEMINI_API_KEY");
      return jsonResponse({ error: "Configuração do servidor incompleta (chave da IA ausente)." }, 500);
    }

    let visceralContext = "";
    if (audienceData?.avatar_profile) {
      const ap = audienceData.avatar_profile as Record<string, unknown>;
      visceralContext = `\n\nPERFIL PSICOLÓGICO DO PÚBLICO\nAvatar: ${ap.avatar || ''}\nObjetivo principal: ${ap.primaryGoal || ''}\nQueixa principal: ${ap.primaryComplaint || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto profundo: ${ap.deepOccultDesire || ''}\nInimigo comum: ${ap.commonEnemy || ''}\nGap de autoimagem: ${ap.selfImageGap || ''}\nFeridas centrais: ${JSON.stringify(ap.coreWounds || [])}\nObjeções: ${JSON.stringify(ap.objections || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nGatilhos de vergonha: ${JSON.stringify(ap.shameTriggers || [])}\nÂncoras de esperança: ${JSON.stringify(ap.hopeAnchors || [])}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\nFalsas soluções: ${JSON.stringify(ap.falseSolutions || [])}\n\nINSTRUÇÕES:\nHOOK: ative shameTriggers/coreWounds, use verbalTriggers\nSTORYTELLING: explore frustrations, falseSolutions, commonEnemy, selfImageGap\nCTA: fale ao deepOccultDesire, use hopeAnchors`;
    }

    const styleMap: Record<string, string> = { casual: "leve, descontraído", profissional: "autoritário, informativo", divertido: "engraçado, irreverente" };
    const styleDesc = styleMap[contentStyle] || styleMap.casual;
    const nicheContext = primaryNiche ? `\nO nicho principal do(a) criador(a) de conteúdo é: ${primaryNiche}.` : '';
    const visceralInstruction = visceralElement ? `\n\nGATILHO VISCERAL OBRIGATÓRIO: ${visceralElement}\n- O HOOK deve ativar EXATAMENTE este gatilho\n- O STORYTELLING deve explorar este tema emocional\n- O CTA deve conectar este gatilho à transformação` : "";

    const systemInstruction = `Você é copywriter especialista em conteúdo para criadores de conteúdo brasileiros. Use linguagem neutra de gênero.${nicheContext}\nEstilo: ${styleDesc}.\n${visceralContext}${visceralInstruction}\n\nRegras: Linguagem natural e coloquial em PT-BR. Hooks com curiosidade imediata. Storytelling pessoal e emocional. CTA sutil. Adapte ao nicho "${primaryNiche || 'lifestyle'}". Cada script deve ser ÚNICO.`;

    const prompt = `Crie uma versão NOVA e MELHORADA do script para o Dia ${day}.\nPilar: ${pillarLabel} (${pillar})\nTítulo: ${title}\n${visceralElement ? `GATILHO VISCERAL: ${visceralElement}\n` : ""}Script de referência (NÃO copie):\n- Hook: ${viralHook}\n- Corpo: ${storytellingBody}\n- CTA: ${subtleConversion}\n\nGere script completamente novo. Adapte ao nicho "${primaryNiche || 'lifestyle'}". Retorne JSON com viralHook, storytellingBody e subtleConversion.`;

    // Retry de nível função: 1 retry extra com 2s se Gemini cair em 503/504/timeout.
    // Não conta cota até sucesso.
    let result: Awaited<ReturnType<typeof callGeminiNative>> | undefined;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        result = await callGeminiNative({
          apiKey: GOOGLE_GEMINI_API_KEY,
          systemInstruction,
          prompt,
          schema: { type: "object", properties: { viralHook: { type: "string" }, storytellingBody: { type: "string" }, subtleConversion: { type: "string" } }, required: ["viralHook", "storytellingBody", "subtleConversion"] },
          tag: `generate-script-try${attempt}`,
          maxOutputTokens: 2000,
          timeoutMs: 60000,
          primaryAttempts: 2,
          fallbackAttempts: 2,
        });
        break;
      } catch (e) {
        lastErr = e;
        const status = e instanceof GeminiError ? e.status : 0;
        if (status === 429 || status === 402) break;
        if (attempt < 2) {
          console.warn(`[generate-script] attempt ${attempt} failed, retrying in 2s`, status);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
    if (!result) {
      const e = lastErr;
      if (e instanceof GeminiError) {
        if (e.status === 429) return jsonResponse({ error: "Muitas requisições à IA. Aguarde alguns segundos." }, 429);
        if (e.status === 402) return jsonResponse({ error: "Créditos da IA esgotados." }, 402);
        if (e.status === 503) return jsonResponse({ error: "O serviço de IA do Google está instável agora. Aguarde 1-2 minutos e tente novamente — sua cota não foi consumida." }, 503);
        return jsonResponse({ error: e.message }, 502);
      }
      throw e;
    }

    const script = result.json as Record<string, unknown>;
    if (!script?.viralHook || !script?.storytellingBody || !script?.subtleConversion) {
      console.error("[generate-script] script incompleto", { keys: Object.keys(script || {}) });
      return jsonResponse({ error: "A IA retornou um script incompleto. Tente novamente." }, 502);
    }

    try {
      await Promise.all([
        adminClient.from("user_usage").update({ script_generations: scriptCount + 1, last_script_date: today }).eq("user_id", userId),
        adminClient.from("usage_logs").insert({ user_id: userId, feature: "script" }),
      ]);
    } catch (e) {
      console.warn("[generate-script] usage update failed (non-fatal)", e);
    }

    console.log("[generate-script] success", { userId, day, model: result.modelUsed, latencyMs: result.latencyMs });
    return jsonResponse(script);
  } catch (e) {
    console.error("[generate-script] uncaught error:", e, { userId });
    const isAbort = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
    return jsonResponse({ error: isAbort ? "A IA está demorando mais que o normal. Tente novamente." : (e instanceof Error ? e.message : "Erro interno") }, isAbort ? 504 : 500);
  }
});
