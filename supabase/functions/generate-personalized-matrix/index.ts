import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiNative } from "../_shared/gemini.ts";

const FUNCTION_VERSION = "2025-04-22-service-role-allsettled-fallback";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "x-influlab-function-version",
  "x-influlab-function-version": FUNCTION_VERSION,
};

console.log(`[matrix] boot v=${FUNCTION_VERSION}`);

const PILLARS: { key: string; label: string }[] = [
  { key: "principal", label: "Principal" },
  { key: "vida-real", label: "Vida Real" },
  { key: "negocios", label: "Negócios" },
  { key: "lifestyle", label: "Lifestyle" },
];

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

  const weekRanges = [[1, 7], [8, 14], [15, 21], [22, 30]];
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

// ─── Fallback local: matriz determinística de 30 dias ───────────
function buildLocalStrategy(day: number, primaryNiche: string, styleDesc: string, dayAssignments: Record<number, string>): Record<string, unknown> {
  const pillar = PILLARS[(day - 1) % PILLARS.length];
  const week = WEEKS.find((w) => day >= w.range[0] && day <= w.range[1]) || WEEKS[0];
  const visceral = dayAssignments[day] || `[Geral] Conteúdo de ${primaryNiche}`;
  const taskType: "connection" | "value" = day % 2 === 0 ? "value" : "connection";

  return {
    day,
    title: `Dia ${day} — ${week.theme.split(" ")[0]} • ${pillar.label}`,
    pillar: pillar.key,
    pillarLabel: pillar.label,
    viralHook: `Se você trabalha com ${primaryNiche} e sente que ${visceral.replace(/^\[[^\]]+\]\s*/, "").slice(0, 80)}, esse vídeo é pra você.`,
    storytellingBody: `Conta uma história real (sua ou de alguém próximo) em 3 atos: situação inicial em ${primaryNiche}, o conflito ligado a "${visceral.replace(/^\[[^\]]+\]\s*/, "")}", e a virada que mostra o caminho. Mantenha tom ${styleDesc}, sem enrolação, em até 60 segundos.`,
    subtleConversion: `Encerre conectando essa virada com um próximo passo simples — convidando a pessoa a salvar, comentar uma palavra ou seguir pra ver o desdobramento amanhã.`,
    visualInstructions: `Plano único, rosto enquadrado, boa luz natural. Texto curto na tela destacando a frase de virada. Música discreta. Corte limpo a cada 3-4 segundos.`,
    taskType,
    visceralElement: visceral,
  };
}

function buildFullLocalMatrix(primaryNiche: string, styleDesc: string, dayAssignments: Record<number, string>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let d = 1; d <= 30; d++) out.push(buildLocalStrategy(d, primaryNiche, styleDesc, dayAssignments));
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY não configurada");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { primaryNiche, secondaryNiches, contentStyle } = await req.json();

    const secondaryList = (secondaryNiches || []).join(", ");
    const styleMap: Record<string, string> = { casual: "leve, descontraído", profissional: "autoritário, informativo", divertido: "engraçado, irreverente" };
    const styleDesc = styleMap[contentStyle] || styleMap.casual;

    const { data: audienceData } = await adminClient
      .from("audience_profiles")
      .select("audience_description, avatar_profile")
      .eq("user_id", userId)
      .maybeSingle();

    let baseAudienceContext = "";
    let dayAssignments: Record<number, string> = {};
    if (audienceData?.avatar_profile) {
      const ap = audienceData.avatar_profile as Record<string, unknown>;
      dayAssignments = distributeVisceralElements(ap);
      baseAudienceContext = `\n\nESTUDO VISCERAL DO PÚBLICO:\nDescrição: ${audienceData.audience_description || ""}\nAvatar: ${ap.avatar || ""}\nObjetivo principal: ${ap.primaryGoal || ""}\nQueixa principal: ${ap.primaryComplaint || ""}\nMedo supremo: ${ap.ultimateFear || ""}\nDesejo oculto: ${ap.deepOccultDesire || ""}\nInimigo comum: ${ap.commonEnemy || ""}\nGap de autoimagem: ${ap.selfImageGap || ""}`;
    }

    // 1) Matriz local garantida (30 dias) — base de fallback
    const localMatrix = buildFullLocalMatrix(primaryNiche, styleDesc, dayAssignments);
    const finalMatrix: Record<string, unknown>[] = [...localMatrix];

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

    // 2) Gemini por semana via allSettled — quem suceder, sobrescreve a parte local
    const t0 = Date.now();
    const weekResults = await Promise.allSettled(
      WEEKS.map(async (week, i) => {
        if (i > 0) await new Promise((r) => setTimeout(r, i * 600));
        const r = await callGeminiNative({
          apiKey: GOOGLE_GEMINI_API_KEY,
          systemInstruction: buildSystem(week),
          prompt: buildPrompt(week),
          schema: { type: "object", properties: { strategies: { type: "array", items: STRATEGY_ITEM_SCHEMA } }, required: ["strategies"] },
          model: "gemini-2.5-flash",
          fallbackModel: "gemini-2.5-flash-lite",
          tag: `matrix-week-${week.num}`,
          maxOutputTokens: 8192,
          timeoutMs: 30000,
          fallbackTimeoutMs: 25000,
          primaryAttempts: 1,
          fallbackAttempts: 1,
        });
        const obj = r.json as { strategies?: unknown[] };
        if (!Array.isArray(obj?.strategies) || obj.strategies.length === 0) {
          throw new Error(`Semana ${week.num}: resposta sem strategies`);
        }
        return { week, strategies: obj.strategies as Record<string, unknown>[] };
      }),
    );

    let aiSuccessWeeks = 0;
    weekResults.forEach((res, idx) => {
      const week = WEEKS[idx];
      if (res.status === "fulfilled") {
        aiSuccessWeeks++;
        for (const s of res.value.strategies) {
          const day = Number((s as Record<string, unknown>).day);
          if (day >= week.range[0] && day <= week.range[1]) {
            finalMatrix[day - 1] = s as Record<string, unknown>;
          }
        }
        console.log(`[matrix] week ${week.num} ai ok — ${res.value.strategies.length} dias`);
      } else {
        console.warn(`[matrix] week ${week.num} fallback —`, res.reason instanceof Error ? res.reason.message : res.reason);
      }
    });

    // Garantia: ordena e valida 30 dias
    finalMatrix.sort((a, b) => Number(a.day) - Number(b.day));
    if (finalMatrix.length < 28) {
      console.error(`[matrix] insufficient strategies: ${finalMatrix.length}`);
      return new Response(JSON.stringify({ error: "Matriz incompleta. Tente novamente.", retryable: true }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[matrix] complete — ${finalMatrix.length} dias, ${aiSuccessWeeks}/4 semanas via AI, ${Date.now() - t0}ms`);

    const { error: upsertError } = await adminClient
      .from("user_strategies")
      .upsert({ user_id: userId, strategies: finalMatrix, generated_at: new Date().toISOString() }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("[matrix] upsert failed:", upsertError);
      return new Response(JSON.stringify({ error: "Falha ao salvar matriz", retryable: true, detail: upsertError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Marca onboarding completo só APÓS write da matriz
    await adminClient.from("user_profiles").update({ onboarding_completed: true }).eq("user_id", userId);

    return new Response(
      JSON.stringify({ strategies: finalMatrix, source: aiSuccessWeeks === 4 ? "ai" : aiSuccessWeeks > 0 ? "mixed" : "fallback", aiSuccessWeeks }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-personalized-matrix error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido", retryable: true }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
