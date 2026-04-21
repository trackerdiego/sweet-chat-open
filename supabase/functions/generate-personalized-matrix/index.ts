import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiNative, GeminiError } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

console.log("[matrix] boot — using native endpoint, responseSchema, 4-week parallel");

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

const STRATEGY_ITEM_SCHEMA = {
  type: "object",
  properties: {
    day: { type: "number" },
    title: { type: "string" },
    pillar: { type: "string", enum: ["principal", "vida-real", "negocios", "lifestyle"] },
    pillarLabel: { type: "string" },
    viralHook: { type: "string" },
    storytellingBody: { type: "string" },
    subtleConversion: { type: "string" },
    visualInstructions: { type: "string" },
    taskType: { type: "string", enum: ["connection", "value"] },
    visceralElement: { type: "string" },
  },
  required: ["day", "title", "pillar", "pillarLabel", "viralHook", "storytellingBody", "subtleConversion", "visualInstructions", "taskType", "visceralElement"],
};

const WEEKS: { num: number; range: [number, number]; theme: string }[] = [
  { num: 1, range: [1, 7],   theme: "OBJEÇÕES e FRUSTRAÇÕES" },
  { num: 2, range: [8, 14],  theme: "FERIDAS e VERGONHA" },
  { num: 3, range: [15, 21], theme: "PECADOS e DESEJOS" },
  { num: 4, range: [22, 30], theme: "ESPERANÇA e DECISÃO" },
];

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

    const { data: audienceData } = await supabase.from("audience_profiles").select("audience_description, avatar_profile").eq("user_id", user.id).maybeSingle();

    let baseAudienceContext = "";
    let dayAssignments: Record<number, string> = {};
    if (audienceData?.avatar_profile) {
      const ap = audienceData.avatar_profile as Record<string, unknown>;
      dayAssignments = distributeVisceralElements(ap);
      baseAudienceContext = `\n\nESTUDO VISCERAL DO PÚBLICO:\nDescrição: ${audienceData.audience_description || ''}\nAvatar: ${ap.avatar || ''}\nObjetivo principal: ${ap.primaryGoal || ''}\nQueixa principal: ${ap.primaryComplaint || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto profundo: ${ap.deepOccultDesire || ''}\nInimigo comum: ${ap.commonEnemy || ''}\nGap de autoimagem: ${ap.selfImageGap || ''}`;
    }

    const secondaryList = (secondaryNiches || []).join(", ");
    const styleMap: Record<string, string> = { casual: "leve, descontraído", profissional: "autoritário, informativo", divertido: "engraçado, irreverente" };
    const styleDesc = styleMap[contentStyle] || styleMap.casual;

    const buildSystem = (week: typeof WEEKS[number]) => {
      const triggers = Object.entries(dayAssignments)
        .filter(([d]) => { const n = Number(d); return n >= week.range[0] && n <= week.range[1]; })
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([day, el]) => `Dia ${day}: GATILHO OBRIGATÓRIO → ${el}`)
        .join("\n");
      return `Você é estrategista de conteúdo digital expert em criar planos de 30 dias para criadores brasileiros. Use linguagem neutra de gênero.
Nicho principal: ${primaryNiche}
Nichos secundários: ${secondaryList || "nenhum"}
Estilo: ${styleDesc}
${baseAudienceContext}

═══════════════════════════════════════════════════════════
SEMANA ${week.num} — TEMA: ${week.theme}
DIAS ${week.range[0]} a ${week.range[1]} (${week.range[1] - week.range[0] + 1} dias)
═══════════════════════════════════════════════════════════
${triggers ? `\nGATILHOS POR DIA (OBRIGATÓRIOS):\n${triggers}\n` : ""}
REGRAS:
1. O HOOK deve ativar o gatilho do dia
2. O STORYTELLING deve explorar o tema emocional
3. O CTA deve conectar o gatilho à transformação
4. visceralElement DEVE conter EXATAMENTE o gatilho designado
5. Cada dia ÚNICO, não repita estruturas
6. NÃO mencione rifa, sorteio ou jogos de azar`;
    };

    const buildPrompt = (week: typeof WEEKS[number]) =>
      `Gere a estratégia para os dias ${week.range[0]} a ${week.range[1]} (${week.range[1] - week.range[0] + 1} estratégias) do nicho "${primaryNiche}". Retorne EXATAMENTE no formato JSON definido pelo schema, com o array "strategies" contendo um objeto por dia, na ordem.`;

    const t0 = Date.now();
    // Stagger: dispara as 4 semanas com 800ms entre cada uma para evitar burst-throttling do Gemini.
    // Continua paralelo (não vira sequencial), mas as requests não saem no mesmo ms.
    const weekResults = await Promise.all(
      WEEKS.map(async (week, i) => {
        if (i > 0) await new Promise((r) => setTimeout(r, i * 800));
        try {
          const r = await callGeminiNative({
            apiKey: GOOGLE_GEMINI_API_KEY,
            systemInstruction: buildSystem(week),
            prompt: buildPrompt(week),
            schema: { type: "object", properties: { strategies: { type: "array", items: STRATEGY_ITEM_SCHEMA } }, required: ["strategies"] },
            model: "gemini-2.5-pro",
            fallbackModel: "gemini-2.5-flash",
            tag: `matrix-week-${week.num}`,
            maxOutputTokens: 8192,
            timeoutMs: 55000,
          });
          const obj = r.json as { strategies?: unknown[] };
          if (!Array.isArray(obj?.strategies)) throw new Error(`Semana ${week.num}: resposta sem strategies`);
          console.log(`[matrix] week ${week.num} ok — ${obj.strategies.length} dias, model=${r.modelUsed}, ${r.latencyMs}ms`);
          return obj.strategies;
        } catch (e) {
          console.error(`[matrix] week ${week.num} failed`, e);
          throw e;
        }
      })
    );

    const allStrategies = weekResults.flat()
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .sort((a, b) => Number(a.day) - Number(b.day));

    if (allStrategies.length < 28) {
      console.error(`[matrix] insufficient strategies generated: ${allStrategies.length}`);
      return new Response(JSON.stringify({ error: "Matriz incompleta. Tente novamente.", retryable: true }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[matrix] complete — ${allStrategies.length} dias em ${Date.now() - t0}ms`);

    const { error: upsertError } = await supabase.from("user_strategies").upsert({ user_id: user.id, strategies: allStrategies, generated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (upsertError) console.error("Error saving strategies:", upsertError);

    return new Response(JSON.stringify({ strategies: allStrategies }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-personalized-matrix error:", e);
    if (e instanceof GeminiError) {
      const status = e.status === 429 ? 429 : e.status === 402 ? 402 : 503;
      const msg = e.status === 429 ? "Limite de requisições excedido." : e.status === 402 ? "Créditos de IA esgotados." : "Erro no serviço de IA. Tente novamente.";
      return new Response(JSON.stringify({ error: msg, retryable: e.status !== 402 }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido", retryable: true }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
