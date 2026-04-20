import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.0-flash";
const RETRIABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGeminiResilient(
  body: Record<string, unknown>,
  apiKey: string,
  tag: string,
  timeoutMs = 60000,
): Promise<Response> {
  const attempt = async (model: string): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };
  const delays = [1000, 3000, 7000];
  const tryModel = async (model: string): Promise<Response | null> => {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await attempt(model);
        if (!RETRIABLE_STATUSES.has(r.status)) {
          const bodyText = await r.text();
          try {
            const parsed = JSON.parse(bodyText);
            const finish = parsed?.choices?.[0]?.finish_reason as string | undefined;
            if (finish && (finish === "MALFORMED_FUNCTION_CALL" || finish.startsWith("function_call_filter"))) {
              console.warn(`[${tag}] Gemini MALFORMED_FUNCTION_CALL on ${model} attempt ${i + 1}/3 (finish_reason=${finish})`);
              if (i < 2) await sleep(delays[i] + Math.floor(Math.random() * 400));
              continue;
            }
          } catch { /* not JSON, fall through */ }
          return new Response(bodyText, { status: r.status, headers: r.headers });
        }
        console.warn(`[${tag}] Gemini ${r.status} on ${model} attempt ${i + 1}/3`);
        try { await r.text(); } catch { /* ignore */ }
      } catch (e) {
        const isAbort = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
        console.warn(`[${tag}] Gemini ${isAbort ? "timeout" : "network error"} on ${model} attempt ${i + 1}/3`, e instanceof Error ? e.message : e);
        if (i === 2 && !isAbort) throw e;
      }
      if (i < 2) await sleep(delays[i] + Math.floor(Math.random() * 400));
    }
    return null;
  };
  const primary = await tryModel(PRIMARY_MODEL);
  if (primary) return primary;
  console.warn(`[${tag}] Primary model ${PRIMARY_MODEL} exhausted, falling back to ${FALLBACK_MODEL}`);
  const fallback = await tryModel(FALLBACK_MODEL);
  if (fallback) return fallback;
  return new Response(JSON.stringify({ error: { message: "All Gemini attempts failed (primary + fallback)" } }), { status: 503 });
}

function distributeVisceralElements(ap: Record<string, unknown>): Record<number, string> {
  const pool: { category: string; item: string }[] = [];
  const addArray = (category: string, key: string) => { const arr = ap[key]; if (Array.isArray(arr)) arr.forEach((item: string) => pool.push({ category, item: String(item) })); };
  const addSins = (label: string, key: string) => { const obj = ap[key]; if (obj && typeof obj === "object" && !Array.isArray(obj)) Object.entries(obj as Record<string, string>).forEach(([sin, desc]) => pool.push({ category: label, item: `${sin}: ${desc}` })); };

  addArray("Objeção", "objections"); addArray("Frustração", "frustrations"); addArray("Falsa solução", "falseSolutions");
  addArray("Ferida central", "coreWounds"); addArray("Gatilho de vergonha", "shameTriggers"); addArray("Crença equivocada", "mistakenBeliefs");
  addSins("Pecado (dor atual)", "sevenSinsCurrent"); addSins("Pecado (motivação)", "sevenSinsFuture"); addArray("Âncora de identidade", "identityAnchors");
  addArray("Âncora de esperança", "hopeAnchors"); addArray("Gatilho de decisão", "decisionTriggers"); addArray("Driver de ansiedade", "anxietyDrivers");
  if (ap.deepOccultDesire) pool.push({ category: "Desejo oculto", item: String(ap.deepOccultDesire) });
  if (ap.ultimateFear) pool.push({ category: "Medo supremo", item: String(ap.ultimateFear) });
  if (ap.commonEnemy) pool.push({ category: "Inimigo comum", item: String(ap.commonEnemy) });
  if (ap.selfImageGap) pool.push({ category: "Gap de autoimagem", item: String(ap.selfImageGap) });
  if (ap.primaryComplaint) pool.push({ category: "Queixa principal", item: String(ap.primaryComplaint) });

  const result: Record<number, string> = {};
  if (pool.length === 0) return result;
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }

  const weekBuckets: { category: string; item: string }[][] = [[], [], [], []];
  const w1 = ["Objeção", "Frustração", "Falsa solução", "Queixa principal"];
  const w2 = ["Ferida central", "Gatilho de vergonha", "Crença equivocada", "Gap de autoimagem"];
  const w3 = ["Pecado (dor atual)", "Pecado (motivação)", "Âncora de identidade", "Desejo oculto", "Inimigo comum"];
  const w4 = ["Âncora de esperança", "Gatilho de decisão", "Driver de ansiedade", "Medo supremo"];
  for (const el of pool) { if (w1.includes(el.category)) weekBuckets[0].push(el); else if (w2.includes(el.category)) weekBuckets[1].push(el); else if (w3.includes(el.category)) weekBuckets[2].push(el); else if (w4.includes(el.category)) weekBuckets[3].push(el); else weekBuckets[Math.floor(Math.random() * 4)].push(el); }

  const weekRanges = [[1,7], [8,14], [15,21], [22,30]];
  for (let w = 0; w < 4; w++) { const [start, end] = weekRanges[w]; const bucket = weekBuckets[w]; for (let day = start; day <= end; day++) { if (bucket.length > 0) { const idx = (day - start) % bucket.length; result[day] = `[${bucket[idx].category}] ${bucket[idx].item}`; } else if (pool.length > 0) { const idx = (day - 1) % pool.length; result[day] = `[${pool[idx].category}] ${pool[idx].item}`; } } }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { primaryNiche, secondaryNiches, contentStyle } = await req.json();
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let visceralContext = "";
    let dayAssignments = "";
    const { data: audienceData } = await supabase.from("audience_profiles").select("audience_description, avatar_profile").eq("user_id", user.id).maybeSingle();

    if (audienceData?.avatar_profile) {
      const ap = audienceData.avatar_profile as Record<string, unknown>;
      const distribution = distributeVisceralElements(ap);
      dayAssignments = Object.entries(distribution).sort(([a], [b]) => Number(a) - Number(b)).map(([day, element]) => `Dia ${day}: GATILHO OBRIGATÓRIO → ${element}`).join("\n");
      visceralContext = `\n\n═══════════════════════════════════════════════════════════\nESTUDO VISCERAL DO PÚBLICO — DISTRIBUIÇÃO OBRIGATÓRIA\n═══════════════════════════════════════════════════════════\n\nDescrição do público: ${audienceData.audience_description || ''}\nAvatar: ${ap.avatar || ''}\nObjetivo principal: ${ap.primaryGoal || ''}\nQueixa principal: ${ap.primaryComplaint || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto profundo: ${ap.deepOccultDesire || ''}\nInimigo comum: ${ap.commonEnemy || ''}\nGap de autoimagem: ${ap.selfImageGap || ''}\n\n═══════════════════════════════════════════════════════════\nMAPEAMENTO OBRIGATÓRIO — CADA DIA TEM UM GATILHO NOMEADO:\n═══════════════════════════════════════════════════════════\n${dayAssignments}\n\nREGRAS:\n1. O HOOK de cada dia DEVE ativar o gatilho listado\n2. O STORYTELLING deve explorar o tema emocional do gatilho\n3. O CTA deve conectar o gatilho à transformação\n4. O campo "visceralElement" deve conter EXATAMENTE o gatilho designado\n5. NUNCA ignore o gatilho designado\n\nSEMANA 1: OBJEÇÕES e FRUSTRAÇÕES\nSEMANA 2: FERIDAS e VERGONHA\nSEMANA 3: PECADOS e DESEJOS\nSEMANA 4: ESPERANÇA e DECISÃO\n═══════════════════════════════════════════════════════════`;
    }

    const secondaryList = (secondaryNiches || []).join(", ");
    const styleMap: Record<string, string> = { casual: "leve, descontraído", profissional: "autoritário, informativo", divertido: "engraçado, irreverente" };
    const styleDesc = styleMap[contentStyle] || styleMap.casual;

    const systemPrompt = `Você é estrategista de conteúdo digital expert em criar planos de 30 dias para criadores de conteúdo brasileiros. Use linguagem neutra de gênero.\nO nicho principal é: ${primaryNiche}\nNichos secundários: ${secondaryList || "nenhum"}\nEstilo: ${styleDesc}\n${visceralContext}\n\nCrie 30 dias de estratégias ÚNICAS. Cada dia deve ter título, pilar, hook viral, storytelling, CTA sutil, instruções visuais e visceralElement.\n\nIMPORTANTE: NÃO mencione rifa, sorteio ou jogos de azar.`;

    const userPrompt = `Gere a matriz completa de 30 dias para um(a) criador(a) de conteúdo do nicho "${primaryNiche}". Retorne usando a function tool.`;

    const response = await callGeminiResilient({
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      tools: [{ type: "function", function: { name: "generate_matrix", description: "Retorna a matriz de 30 dias", parameters: { type: "object", properties: { strategies: { type: "array", items: { type: "object", properties: { day: { type: "number" }, title: { type: "string" }, pillar: { type: "string", enum: ["principal", "vida-real", "negocios", "lifestyle"] }, pillarLabel: { type: "string" }, viralHook: { type: "string" }, storytellingBody: { type: "string" }, subtleConversion: { type: "string" }, visualInstructions: { type: "string" }, taskType: { type: "string", enum: ["connection", "value"] }, visceralElement: { type: "string" } }, required: ["day", "title", "pillar", "pillarLabel", "viralHook", "storytellingBody", "subtleConversion", "visualInstructions", "taskType", "visceralElement"] } } }, required: ["strategies"], additionalProperties: false } } }],
      tool_choice: { type: "function", function: { name: "generate_matrix" } },
    }, GOOGLE_GEMINI_API_KEY, "matrix");

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const text = await response.text(); console.error("AI error:", response.status, text);
      return new Response(JSON.stringify({ error: "Erro ao gerar matriz personalizada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("Resposta da IA sem dados estruturados");
    const result = JSON.parse(toolCall.function.arguments);

    const { error: upsertError } = await supabase.from("user_strategies").upsert({ user_id: user.id, strategies: result.strategies, generated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (upsertError) console.error("Error saving strategies:", upsertError);

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-personalized-matrix error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});