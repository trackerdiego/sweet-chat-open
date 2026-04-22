// start-onboarding-run
// Cria um run de onboarding e dispara o processamento das 4 etapas em background
// usando EdgeRuntime.waitUntil. Retorna em <1s — imune a timeouts de Kong/Nginx.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiNative } from "../_shared/gemini.ts";

const FUNCTION_VERSION = "2026-04-22-async-job";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "x-influlab-function-version",
  "x-influlab-function-version": FUNCTION_VERSION,
};

console.log(`[start-onboarding-run] boot v=${FUNCTION_VERSION}`);

// ─── Tipos ─────────────────────────────────────────────────────
type StageKey = "profile" | "audience" | "visceral" | "matrix";
type StageStatus = "pending" | "running" | "done" | "error";
interface StageRecord {
  key: StageKey;
  label: string;
  status: StageStatus;
  started_at?: string;
  finished_at?: string;
  error?: string;
  source?: "ai" | "fallback" | "mixed";
}

const STAGE_LABELS: Record<StageKey, string> = {
  profile: "Preparando seu perfil",
  audience: "Analisando seu público",
  visceral: "Construindo estudo visceral",
  matrix: "Montando sua matriz de 30 dias",
};

const initialStages = (): StageRecord[] =>
  (Object.keys(STAGE_LABELS) as StageKey[]).map((k) => ({
    key: k,
    label: STAGE_LABELS[k],
    status: "pending",
  }));

// ─── Schemas Gemini ────────────────────────────────────────────
const AVATAR_SCHEMA = {
  type: "object",
  properties: {
    niche: { type: "string" }, avatar: { type: "string" },
    primaryGoal: { type: "string" }, primaryComplaint: { type: "string" },
    secondaryGoals: { type: "array", items: { type: "string" } },
    secondaryComplaints: { type: "array", items: { type: "string" } },
    promises: { type: "array", items: { type: "string" } },
    benefits: { type: "array", items: { type: "string" } },
    objections: { type: "array", items: { type: "string" } },
    confusions: { type: "array", items: { type: "string" } },
    ultimateFear: { type: "string" },
    falseSolutions: { type: "array", items: { type: "string" } },
    mistakenBeliefs: { type: "array", items: { type: "string" } },
    frustrations: { type: "array", items: { type: "string" } },
    everydayRelatability: { type: "string" },
    commonEnemy: { type: "string" }, tribe: { type: "string" },
    deepOccultDesire: { type: "string" },
    coreWounds: { type: "array", items: { type: "string" } },
    sevenSinsCurrent: { type: "object", properties: { greed: { type: "string" }, gluttony: { type: "string" }, envy: { type: "string" }, wrath: { type: "string" }, lust: { type: "string" }, sloth: { type: "string" }, pride: { type: "string" } }, required: ["greed","gluttony","envy","wrath","lust","sloth","pride"] },
    sevenSinsFuture: { type: "object", properties: { greed: { type: "string" }, gluttony: { type: "string" }, envy: { type: "string" }, wrath: { type: "string" }, lust: { type: "string" }, sloth: { type: "string" }, pride: { type: "string" } }, required: ["greed","gluttony","envy","wrath","lust","sloth","pride"] },
    shameTriggers: { type: "array", items: { type: "string" } },
    anxietyDrivers: { type: "array", items: { type: "string" } },
    hopeAnchors: { type: "array", items: { type: "string" } },
    decisionTriggers: { type: "array", items: { type: "string" } },
    verbalTriggers: { type: "array", items: { type: "string" } },
    identityAnchors: { type: "array", items: { type: "string" } },
    selfImageGap: { type: "string" },
  },
  required: ["niche", "avatar", "primaryGoal", "primaryComplaint", "ultimateFear", "deepOccultDesire"],
};

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

const PILLARS = [
  { key: "principal", label: "Principal" },
  { key: "vida-real", label: "Vida Real" },
  { key: "negocios", label: "Negócios" },
  { key: "lifestyle", label: "Lifestyle" },
];

const WEEKS = [
  { num: 1, range: [1, 7],   theme: "OBJEÇÕES e FRUSTRAÇÕES" },
  { num: 2, range: [8, 14],  theme: "FERIDAS e VERGONHA" },
  { num: 3, range: [15, 21], theme: "PECADOS e DESEJOS" },
  { num: 4, range: [22, 30], theme: "ESPERANÇA e DECISÃO" },
] as const;

// ─── Fallbacks locais ──────────────────────────────────────────
function buildFallbackDescription(primaryNiche: string, secondaryList: string, styleDesc: string): string {
  return `Público-alvo de criadores(as) brasileiros(as) interessados(as) em ${primaryNiche}${secondaryList ? `, com afinidade por ${secondaryList}` : ""}. Pessoas entre 22 e 40 anos, conectadas, que consomem conteúdo curto e direto nas redes sociais (Instagram, TikTok, YouTube). Buscam transformação real e prática, valorizam autenticidade e se identificam com criadores(as) que falam de forma ${styleDesc}. Sentem frustração com promessas vazias do mercado digital, têm medo de investir tempo/dinheiro e não ver resultado, e desejam profundamente uma virada de chave. Salvam posts úteis, comentam quando se identificam, seguem por consistência, abandonam quando vira só venda.`;
}

function buildFallbackAvatar(primaryNiche: string, secondaryList: string): Record<string, unknown> {
  return {
    niche: primaryNiche,
    avatar: `Pessoa entre 25 e 38 anos, brasileira, conectada, em busca de domínio em ${primaryNiche}.`,
    primaryGoal: `Conquistar autoridade e resultado consistente em ${primaryNiche}.`,
    primaryComplaint: "Faço tudo que dizem e mesmo assim não vejo resultado proporcional.",
    secondaryGoals: ["Construir audiência fiel", "Renda previsível", "Ser referência"],
    secondaryComplaints: ["Algoritmo imprevisível", "Falta de tempo", "Gritar no vácuo"],
    promises: ["Clareza", "Direção estratégica", "Resultados mensuráveis"],
    benefits: ["Engajamento real", "Posicionamento claro", "Confiança"],
    objections: ["Já tentei tudo", "Não tenho tempo", "Vai ser igual aos outros"],
    confusions: ["Volume ou qualidade?", "O que o algoritmo quer?", "Como medir?"],
    ultimateFear: "Continuar invisível trabalhando muito sem reconhecimento.",
    falseSolutions: ["Postar mais", "Copiar trends", "Comprar seguidores"],
    mistakenBeliefs: ["Quem ganha é quem posta mais", "É sorte com algoritmo", "Preciso ser perfeito(a)"],
    frustrations: ["Viralizar uma vez só", "Sem ideias", "Comparação"],
    everydayRelatability: "Acorda olhando notificações, abre concorrentes, tenta reescrever roteiro.",
    commonEnemy: "Gurus de fórmula mágica e algoritmos que mudam toda semana.",
    tribe: `Criadores(as) sérios(as) em ${primaryNiche}${secondaryList ? ` e ${secondaryList}` : ""}.`,
    deepOccultDesire: "Ser referência incontestável.",
    coreWounds: ["Esforço não reconhecido", "Não ser bom(a) o suficiente", "Vergonha de falhar"],
    sevenSinsCurrent: { greed: "Mais alcance", gluttony: "Consome cursos sem aplicar", envy: "Olha pra maiores", wrath: "Raiva do algoritmo", lust: "Quer a vida do criador top", sloth: "Procrastina estratégia", pride: "Acha que já sabe" },
    sevenSinsFuture: { greed: "Dominar o nicho", gluttony: "Devorar conhecimento real", envy: "Ser invejado(a)", wrath: "Provar pra quem duvidou", lust: "Liberdade total", sloth: "Sistema com menos esforço", pride: "Orgulho legítimo" },
    shameTriggers: ["Poucas views", "Comentário negativo", "Família perguntando se dá dinheiro"],
    anxietyDrivers: ["Mudanças do algoritmo", "Sem ideia", "Comparação"],
    hopeAnchors: ["Comentário sincero", "Crescimento pequeno", "Reconhecimento de pares"],
    decisionTriggers: ["Resultado real de alguém parecido(a)", "Método claro", "Economiza tempo"],
    verbalTriggers: ["Estratégia", "Autoridade", "Posicionamento", "Sem enrolação", "Resultado real"],
    identityAnchors: [`Sou criador(a) em ${primaryNiche}`, "Construo algo próprio", "Sou referência em formação"],
    selfImageGap: "Vê potencial enorme não reconhecido — gap entre dentro e fora.",
  };
}

function distributeVisceralElements(ap: Record<string, unknown>): Record<number, string> {
  const pool: { category: string; item: string }[] = [];
  const addArray = (c: string, k: string) => { const arr = ap[k]; if (Array.isArray(arr)) arr.forEach((it: string) => pool.push({ category: c, item: String(it) })); };
  const addSins = (l: string, k: string) => { const o = ap[k]; if (o && typeof o === "object" && !Array.isArray(o)) Object.entries(o as Record<string, string>).forEach(([s, d]) => pool.push({ category: l, item: `${s}: ${d}` })); };
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
  const buckets: { category: string; item: string }[][] = [[], [], [], []];
  const w1 = ["Objeção","Frustração","Falsa solução","Queixa principal"];
  const w2 = ["Ferida central","Gatilho de vergonha","Crença equivocada","Gap de autoimagem"];
  const w3 = ["Pecado (dor atual)","Pecado (motivação)","Âncora de identidade","Desejo oculto","Inimigo comum"];
  const w4 = ["Âncora de esperança","Gatilho de decisão","Driver de ansiedade","Medo supremo"];
  for (const el of pool) { if (w1.includes(el.category)) buckets[0].push(el); else if (w2.includes(el.category)) buckets[1].push(el); else if (w3.includes(el.category)) buckets[2].push(el); else if (w4.includes(el.category)) buckets[3].push(el); else buckets[Math.floor(Math.random() * 4)].push(el); }
  const ranges: [number, number][] = [[1,7],[8,14],[15,21],[22,30]];
  for (let w = 0; w < 4; w++) { const [s, e] = ranges[w]; const b = buckets[w]; for (let day = s; day <= e; day++) { if (b.length > 0) { const idx = (day - s) % b.length; result[day] = `[${b[idx].category}] ${b[idx].item}`; } else if (pool.length > 0) { const idx = (day - 1) % pool.length; result[day] = `[${pool[idx].category}] ${pool[idx].item}`; } } }
  return result;
}

function buildLocalStrategy(day: number, primaryNiche: string, styleDesc: string, dayAssignments: Record<number, string>): Record<string, unknown> {
  const pillar = PILLARS[(day - 1) % PILLARS.length];
  const week = WEEKS.find((w) => day >= w.range[0] && day <= w.range[1]) || WEEKS[0];
  const visceral = dayAssignments[day] || `[Geral] Conteúdo de ${primaryNiche}`;
  const taskType: "connection" | "value" = day % 2 === 0 ? "value" : "connection";
  return {
    day,
    title: `Dia ${day} — ${week.theme.split(" ")[0]} • ${pillar.label}`,
    pillar: pillar.key, pillarLabel: pillar.label,
    viralHook: `Se você trabalha com ${primaryNiche} e sente que ${visceral.replace(/^\[[^\]]+\]\s*/, "").slice(0, 80)}, esse vídeo é pra você.`,
    storytellingBody: `Conta uma história em 3 atos: situação inicial em ${primaryNiche}, conflito ligado a "${visceral.replace(/^\[[^\]]+\]\s*/, "")}", virada que mostra o caminho. Tom ${styleDesc}, até 60s.`,
    subtleConversion: `Conecte essa virada com um próximo passo simples — convide a salvar, comentar uma palavra ou seguir.`,
    visualInstructions: `Plano único, rosto enquadrado, luz natural. Texto curto destacando a virada. Cortes a cada 3-4s.`,
    taskType, visceralElement: visceral,
  };
}

// ─── Helpers de DB ─────────────────────────────────────────────
async function updateRun(admin: ReturnType<typeof createClient>, runId: string, patch: Record<string, unknown>) {
  await admin.from("onboarding_runs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", runId);
}

async function setStage(admin: ReturnType<typeof createClient>, runId: string, stages: StageRecord[], key: StageKey, patch: Partial<StageRecord>) {
  const idx = stages.findIndex((s) => s.key === key);
  if (idx < 0) return stages;
  stages[idx] = { ...stages[idx], ...patch };
  const stageNum = idx + 1;
  await updateRun(admin, runId, { stages, current_stage: stageNum, status: "running" });
  return stages;
}

// ─── Worker em background ─────────────────────────────────────
async function processRun(runId: string, userId: string, input: { primaryNiche: string; secondaryNiches: string[]; contentStyle: string; displayName: string }) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY")!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let stages = initialStages();
  await updateRun(admin, runId, { stages, status: "running", current_stage: 1 });

  const styleMap: Record<string, string> = { casual: "leve, descontraído", profissional: "autoritário, informativo", divertido: "engraçado, irreverente" };
  const styleDesc = styleMap[input.contentStyle] || styleMap.casual;
  const secondaryList = (input.secondaryNiches || []).join(", ");

  // ═══ ETAPA 1: profile ═══
  try {
    stages = await setStage(admin, runId, stages, "profile", { status: "running", started_at: new Date().toISOString() });
    const { error } = await admin.from("user_profiles").upsert({
      user_id: userId,
      display_name: input.displayName,
      primary_niche: input.primaryNiche,
      secondary_niches: input.secondaryNiches || [],
      content_style: input.contentStyle,
      description_status: "ok",
      onboarding_completed: false,
    }, { onConflict: "user_id" });
    if (error) throw new Error(`profile upsert: ${error.message}`);
    stages = await setStage(admin, runId, stages, "profile", { status: "done", finished_at: new Date().toISOString() });
    console.log(`[run ${runId}] stage 1 profile ok`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stages = await setStage(admin, runId, stages, "profile", { status: "error", finished_at: new Date().toISOString(), error: msg });
    await updateRun(admin, runId, { status: "failed", error_message: `profile: ${msg}`, completed_at: new Date().toISOString() });
    return;
  }

  // ═══ ETAPA 2: audience description ═══
  let audienceDescription = "";
  try {
    stages = await setStage(admin, runId, stages, "audience", { status: "running", started_at: new Date().toISOString() });
    let source: "ai" | "fallback" = "ai";
    try {
      const r = await callGeminiNative({
        apiKey: GEMINI_KEY,
        systemInstruction: `Você é uma estrategista de público digital especialista em criadores(as) brasileiros(as). Use linguagem neutra de gênero.`,
        prompt: `Crie uma descrição rica e detalhada do público-alvo ideal para um(a) criador(a) com base nesta descrição:\n\n${input.primaryNiche}\n${secondaryList ? `Interesses complementares: ${secondaryList}` : ""}\nEstilo: ${styleDesc}\n\nInclua: demografia, psicografia, consumo de conteúdo, dores, frustrações, desejos, comportamento social, transformação buscada. Específico e visceral.`,
        model: "gemini-2.5-flash", fallbackModel: "gemini-2.5-flash-lite",
        tag: "run-audience", maxOutputTokens: 3000, timeoutMs: 25000, fallbackTimeoutMs: 20000,
        primaryAttempts: 1, fallbackAttempts: 1,
      });
      audienceDescription = (r.text || "").trim();
      if (!audienceDescription || audienceDescription.length < 80) throw new Error("descrição muito curta");
    } catch (err) {
      source = "fallback";
      audienceDescription = buildFallbackDescription(input.primaryNiche, secondaryList, styleDesc);
      console.warn(`[run ${runId}] audience fallback —`, err instanceof Error ? err.message : err);
    }
    const { error } = await admin.from("audience_profiles").upsert({
      user_id: userId, audience_description: audienceDescription, generated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error(`audience upsert: ${error.message}`);
    await admin.from("user_profiles").update({ description_status: "ready" }).eq("user_id", userId);
    stages = await setStage(admin, runId, stages, "audience", { status: "done", finished_at: new Date().toISOString(), source });
    console.log(`[run ${runId}] stage 2 audience ok (${source})`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stages = await setStage(admin, runId, stages, "audience", { status: "error", finished_at: new Date().toISOString(), error: msg });
    await updateRun(admin, runId, { status: "failed", error_message: `audience: ${msg}`, completed_at: new Date().toISOString() });
    return;
  }

  // ═══ ETAPA 3: visceral avatar ═══
  let avatarProfile: Record<string, unknown> = {};
  try {
    stages = await setStage(admin, runId, stages, "visceral", { status: "running", started_at: new Date().toISOString() });
    let source: "ai" | "fallback" = "ai";
    try {
      const r = await callGeminiNative({
        apiKey: GEMINI_KEY,
        systemInstruction: `Act as a Master Copywriter and Direct Response Strategist. Visceral, real, dimensional. CRITICAL: Output in Brazilian Portuguese, linguagem neutra de gênero.`,
        prompt: `[Audience]= Criador(a) brasileiro(a). Negócio:\n"${input.primaryNiche}"\n${secondaryList ? `Complementares: ${secondaryList}` : ""}\nEstilo: ${styleDesc}\n\nDescrição do público:\n${audienceDescription}\n\nPreencha o avatar completo no JSON do schema. Visceral, profundo, específico. TODOS os campos.`,
        schema: AVATAR_SCHEMA,
        model: "gemini-2.5-flash", fallbackModel: "gemini-2.5-flash-lite",
        tag: "run-visceral", maxOutputTokens: 8192, timeoutMs: 35000, fallbackTimeoutMs: 25000,
        primaryAttempts: 1, fallbackAttempts: 1,
      });
      const parsed = r.json as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || !parsed.avatar) throw new Error("avatar inválido");
      avatarProfile = parsed;
    } catch (err) {
      source = "fallback";
      avatarProfile = buildFallbackAvatar(input.primaryNiche, secondaryList);
      console.warn(`[run ${runId}] visceral fallback —`, err instanceof Error ? err.message : err);
    }
    const { error } = await admin.from("audience_profiles").upsert({
      user_id: userId, audience_description: audienceDescription, avatar_profile: avatarProfile, generated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error(`visceral upsert: ${error.message}`);
    stages = await setStage(admin, runId, stages, "visceral", { status: "done", finished_at: new Date().toISOString(), source });
    console.log(`[run ${runId}] stage 3 visceral ok (${source})`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stages = await setStage(admin, runId, stages, "visceral", { status: "error", finished_at: new Date().toISOString(), error: msg });
    await updateRun(admin, runId, { status: "failed", error_message: `visceral: ${msg}`, completed_at: new Date().toISOString() });
    return;
  }

  // ═══ ETAPA 4: matrix 30 dias ═══
  try {
    stages = await setStage(admin, runId, stages, "matrix", { status: "running", started_at: new Date().toISOString() });
    const dayAssignments = distributeVisceralElements(avatarProfile);
    const localMatrix: Record<string, unknown>[] = [];
    for (let d = 1; d <= 30; d++) localMatrix.push(buildLocalStrategy(d, input.primaryNiche, styleDesc, dayAssignments));
    const finalMatrix = [...localMatrix];

    const baseCtx = `\nESTUDO VISCERAL:\nDescrição: ${audienceDescription}\nAvatar: ${avatarProfile.avatar || ""}\nObjetivo: ${avatarProfile.primaryGoal || ""}\nQueixa: ${avatarProfile.primaryComplaint || ""}\nMedo: ${avatarProfile.ultimateFear || ""}\nDesejo: ${avatarProfile.deepOccultDesire || ""}`;
    const buildSystem = (week: typeof WEEKS[number]) => {
      const triggers = Object.entries(dayAssignments)
        .filter(([d]) => { const n = Number(d); return n >= week.range[0] && n <= week.range[1]; })
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([day, el]) => `Dia ${day}: GATILHO → ${el}`).join("\n");
      return `Estrategista de conteúdo para criadores brasileiros. Linguagem neutra.\nNicho: ${input.primaryNiche}\nSecundários: ${secondaryList || "nenhum"}\nEstilo: ${styleDesc}${baseCtx}\n\nSEMANA ${week.num} — ${week.theme}\nDIAS ${week.range[0]} a ${week.range[1]}\n${triggers ? `\nGATILHOS:\n${triggers}\n` : ""}\nREGRAS: hook ativa o gatilho; storytelling explora tema; CTA conecta à transformação; visceralElement = gatilho exato; cada dia único; sem rifa/sorteio.`;
    };
    const buildPrompt = (week: typeof WEEKS[number]) =>
      `Gere estratégia para os dias ${week.range[0]} a ${week.range[1]} (${week.range[1] - week.range[0] + 1} estratégias) do nicho "${input.primaryNiche}". Retorne EXATO no formato JSON do schema com array "strategies".`;

    const weekResults = await Promise.allSettled(
      WEEKS.map(async (week, i) => {
        if (i > 0) await new Promise((r) => setTimeout(r, i * 600));
        const r = await callGeminiNative({
          apiKey: GEMINI_KEY,
          systemInstruction: buildSystem(week), prompt: buildPrompt(week),
          schema: { type: "object", properties: { strategies: { type: "array", items: STRATEGY_ITEM_SCHEMA } }, required: ["strategies"] },
          model: "gemini-2.5-flash", fallbackModel: "gemini-2.5-flash-lite",
          tag: `run-matrix-w${week.num}`, maxOutputTokens: 8192,
          timeoutMs: 40000, fallbackTimeoutMs: 30000, primaryAttempts: 1, fallbackAttempts: 1,
        });
        const obj = r.json as { strategies?: unknown[] };
        if (!Array.isArray(obj?.strategies) || obj.strategies.length === 0) throw new Error(`semana ${week.num} vazia`);
        return { week, strategies: obj.strategies as Record<string, unknown>[] };
      }),
    );

    let aiOk = 0;
    weekResults.forEach((res, idx) => {
      const week = WEEKS[idx];
      if (res.status === "fulfilled") {
        aiOk++;
        for (const s of res.value.strategies) {
          const day = Number((s as Record<string, unknown>).day);
          if (day >= week.range[0] && day <= week.range[1]) finalMatrix[day - 1] = s as Record<string, unknown>;
        }
      } else {
        console.warn(`[run ${runId}] matrix week ${week.num} fallback —`, res.reason instanceof Error ? res.reason.message : res.reason);
      }
    });
    finalMatrix.sort((a, b) => Number(a.day) - Number(b.day));
    if (finalMatrix.length < 28) throw new Error(`matriz incompleta (${finalMatrix.length})`);

    const { error: upErr } = await admin.from("user_strategies").upsert({
      user_id: userId, strategies: finalMatrix, generated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (upErr) throw new Error(`strategies upsert: ${upErr.message}`);

    await admin.from("user_profiles").update({ onboarding_completed: true }).eq("user_id", userId);

    const matrixSource: "ai" | "mixed" | "fallback" = aiOk === 4 ? "ai" : aiOk > 0 ? "mixed" : "fallback";
    stages = await setStage(admin, runId, stages, "matrix", { status: "done", finished_at: new Date().toISOString(), source: matrixSource });
    await updateRun(admin, runId, { status: "completed", completed_at: new Date().toISOString() });
    console.log(`[run ${runId}] stage 4 matrix ok — ${aiOk}/4 weeks AI, total ${finalMatrix.length} dias`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stages = await setStage(admin, runId, stages, "matrix", { status: "error", finished_at: new Date().toISOString(), error: msg });
    await updateRun(admin, runId, { status: "failed", error_message: `matrix: ${msg}`, completed_at: new Date().toISOString() });
  }
}

// ─── Handler HTTP ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const { displayName, primaryNiche, secondaryNiches, contentStyle, resumeRunId } = body as {
      displayName?: string; primaryNiche?: string; secondaryNiches?: string[]; contentStyle?: string; resumeRunId?: string;
    };

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Resume: se já tem um run pending/running deste usuário, devolve ele
    if (resumeRunId) {
      const { data: existing } = await admin.from("onboarding_runs").select("id, status, user_id").eq("id", resumeRunId).maybeSingle();
      if (existing && existing.user_id === user.id && (existing.status === "pending" || existing.status === "running")) {
        return new Response(JSON.stringify({ runId: existing.id, resumed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!displayName || !primaryNiche || !contentStyle) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: displayName, primaryNiche, contentStyle" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (primaryNiche.trim().length < 80) {
      return new Response(JSON.stringify({ error: "primaryNiche precisa ter pelo menos 80 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const input = {
      displayName: displayName.trim(),
      primaryNiche: primaryNiche.trim(),
      secondaryNiches: secondaryNiches || [],
      contentStyle: contentStyle.trim(),
    };

    const { data: created, error: createErr } = await admin.from("onboarding_runs").insert({
      user_id: user.id,
      status: "pending",
      current_stage: 1,
      stages: initialStages(),
      input_payload: input,
    }).select("id").single();
    if (createErr || !created) {
      console.error("[start-onboarding-run] create failed:", createErr);
      return new Response(JSON.stringify({ error: "Falha ao criar run", detail: createErr?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const runId = created.id as string;

    // Dispara processamento em background — request HTTP retorna IMEDIATAMENTE.
    // EdgeRuntime.waitUntil mantém o worker vivo até worker_timeout_ms (~150s).
    // @ts-ignore Deno EdgeRuntime global
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processRun(runId, user.id, input));
    } else {
      // Fallback (dev local sem EdgeRuntime): roda sem await
      processRun(runId, user.id, input).catch((e) => console.error(`[run ${runId}] uncaught`, e));
    }

    return new Response(JSON.stringify({ runId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("start-onboarding-run error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
