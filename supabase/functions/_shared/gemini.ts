// Shared helper: chamadas ao Gemini via endpoint NATIVO (não OpenAI-compat).
// Por quê: endpoint /v1beta/models/{model}:generateContent + responseSchema é
// drasticamente mais estável que /v1beta/openai/chat/completions + tool_calls,
// elimina MALFORMED_FUNCTION_CALL e reduz drasticamente 503 espúrios.
//
// Uso:
//   const json = await callGeminiNative({
//     systemInstruction: "Você é...",
//     prompt: "Gere ...",
//     schema: { type: "object", properties: {...}, required: [...] },
//     tag: "matrix-week-1",
//   });

const RETRIABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const ALLOWED_MODELS = new Set([
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
]);

// Retriable substrings encontrados em error envelopes 200-OK do Gemini
// (sim, ele às vezes retorna 200 com erro no body)
const RETRIABLE_BODY_HINTS = [
  "UNAVAILABLE",
  "overloaded",
  "RESOURCE_EXHAUSTED",
  "deadline",
  "503",
  "try again later",
  "model is currently overloaded",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Backoff exponencial com jitter. attempt começa em 0.
function backoffMs(attempt: number, retryAfterSec?: number): number {
  if (retryAfterSec && retryAfterSec > 0) {
    // Respeita Retry-After do Gemini, capado em 15s
    return Math.min(retryAfterSec * 1000, 15000);
  }
  // 2s, 5s, 10s, 15s (cap) — cada um com ±25% jitter
  const base = [2000, 5000, 10000, 15000][Math.min(attempt, 3)];
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.max(500, Math.round(base + jitter));
}

function parseRetryAfter(res: Response): number | undefined {
  const h = res.headers.get("retry-after");
  if (!h) return undefined;
  const n = parseInt(h, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function bodyLooksRetriable(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return RETRIABLE_BODY_HINTS.some((h) => lower.includes(h.toLowerCase()));
}

function logEvent(tag: string, fields: Record<string, unknown>) {
  try {
    console.log(`[gemini] ${tag} ${JSON.stringify(fields)}`);
  } catch {
    console.log(`[gemini] ${tag}`, fields);
  }
}

// JSON Schema → Gemini OpenAPI subset.
// Gemini não aceita additionalProperties, $schema, etc. e exige type em UPPERCASE em alguns campos.
// Mantemos o schema lowercase (compatível) mas removemos chaves não suportadas.
function sanitizeSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(sanitizeSchema);
  if (s && typeof s === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
      if (k === "additionalProperties" || k === "$schema" || k === "definitions") continue;
      out[k] = sanitizeSchema(v);
    }
    return out;
  }
  return s;
}

function parseLooseJson(raw: string): unknown {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const cleaned = s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(cleaned);
}

export type GeminiOptions = {
  apiKey: string;
  systemInstruction?: string;
  prompt?: string;
  contents?: Array<{ role?: string; parts: Array<Record<string, unknown>> }>;
  schema?: object; // se presente, força JSON estruturado via responseSchema
  // Cascata de modelos: tenta primary → mid → fallback. Cada nível com seus attempts.
  model?: string; // default gemini-2.5-pro
  midModel?: string; // default gemini-2.5-flash
  fallbackModel?: string; // default gemini-2.5-flash-lite
  timeoutMs?: number; // timeout por chamada do primary (default 35s)
  midTimeoutMs?: number; // default 30s
  fallbackTimeoutMs?: number; // default 25s
  globalDeadlineMs?: number; // teto total da função (default 90s)
  maxOutputTokens?: number; // default 8192
  temperature?: number;
  primaryAttempts?: number; // default 2
  midAttempts?: number; // default 2
  fallbackAttempts?: number; // default 3
  tag: string;
};

export type GeminiResult = {
  json?: unknown;
  text?: string;
  modelUsed: string;
  latencyMs: number;
  attempts: number; // total de chamadas HTTP feitas (todos os modelos)
};

export class GeminiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public attempts?: number,
    public modelUsed?: string,
  ) {
    super(`Gemini ${status}: ${detail}`);
  }
}

function extractTextFromEnvelope(envelope: unknown): string | null {
  const candidates = (envelope as Record<string, unknown> | null)?.["candidates"];
  const firstCandidate = Array.isArray(candidates) ? candidates[0] : undefined;
  const extractedText = firstCandidate?.content?.parts?.[0]?.text;
  return typeof extractedText === "string" ? extractedText : null;
}

async function callOnce(
  model: string,
  body: Record<string, unknown>,
  apiKey: string,
  timeoutMs: number,
): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function repairJsonWithGemini(opts: {
  apiKey: string;
  rawText: string;
  schema: object;
  tag: string;
  remainingMs: number;
}): Promise<unknown | null> {
  if (opts.remainingMs < 5000) return null;
  const body: Record<string, unknown> = {
    contents: [{
      role: "user",
      parts: [{
        text: `Corrija o texto abaixo para JSON válido que respeite o schema solicitado. Retorne APENAS o JSON, sem markdown.\n\nTEXTO:\n${opts.rawText.slice(0, 12000)}`,
      }],
    }],
    generationConfig: {
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      responseSchema: sanitizeSchema(opts.schema),
    },
  };
  try {
    const res = await callOnce("gemini-2.5-flash-lite", body, opts.apiKey, Math.min(12000, opts.remainingMs));
    const text = await res.text();
    if (!res.ok) {
      logEvent("json-repair-fail", { tag: opts.tag, status: res.status, sample: text.slice(0, 200) });
      return null;
    }
    const envelope = JSON.parse(text);
    const repairedText = extractTextFromEnvelope(envelope);
    if (!repairedText) return null;
    return parseLooseJson(repairedText);
  } catch (e) {
    logEvent("json-repair-error", { tag: opts.tag, err: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

export async function callGeminiNative(opts: GeminiOptions): Promise<GeminiResult> {
  const primary = opts.model ?? "gemini-2.5-pro";
  const mid = opts.midModel ?? "gemini-2.5-flash";
  const fallback = opts.fallbackModel ?? "gemini-2.5-flash-lite";

  for (const m of [primary, mid, fallback]) {
    if (!ALLOWED_MODELS.has(m)) {
      console.error(`[${opts.tag}] BOOT GUARD: modelo não permitido`, { model: m });
    }
  }

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: opts.maxOutputTokens ?? 8192,
  };
  if (typeof opts.temperature === "number") generationConfig.temperature = opts.temperature;
  if (opts.schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = sanitizeSchema(opts.schema);
  }

  const body: Record<string, unknown> = {
    contents: opts.contents ?? [{ role: "user", parts: [{ text: opts.prompt ?? "" }] }],
    generationConfig,
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  const startedAt = Date.now();
  const globalDeadline = startedAt + (opts.globalDeadlineMs ?? 90000);
  let totalAttempts = 0;
  let lastError: { status: number; detail: string } | null = null;

  // Tenta um modelo com N attempts. Pula etapas se passar do globalDeadline.
  const tryTier = async (
    model: string,
    attempts: number,
    perCallTimeoutMs: number,
  ): Promise<{ res: Response; text: string } | "EXHAUSTED" | "DEADLINE"> => {
    for (let i = 0; i < attempts; i++) {
      if (Date.now() >= globalDeadline) return "DEADLINE";
      totalAttempts++;
      const t0 = Date.now();

      // Garante que o timeout da chamada não estoura o globalDeadline
      const remainingBudget = globalDeadline - Date.now();
      const callTimeout = Math.max(5000, Math.min(perCallTimeoutMs, remainingBudget));

      let isAbort = false;
      try {
        const res = await callOnce(model, body, opts.apiKey, callTimeout);
        const latency = Date.now() - t0;

        // 5xx/429 → retriable
        if (RETRIABLE_STATUSES.has(res.status)) {
          const retryAfter = parseRetryAfter(res);
          let bodyText = "";
          try { bodyText = await res.text(); } catch { /* ignore */ }
          lastError = { status: res.status, detail: bodyText.slice(0, 300) };
          logEvent("retry-status", { tag: opts.tag, model, attempt: i + 1, attempts, status: res.status, latencyMs: latency, retryAfter });
          if (i < attempts - 1 && Date.now() < globalDeadline) {
            await sleep(backoffMs(i, retryAfter));
          }
          continue;
        }

        // 200 mas pode ter erro no envelope ou finishReason ruim
        const text = await res.text();

        // Body com sinal de overload mesmo em 200 (acontece com Gemini)
        if (!res.ok) {
          lastError = { status: res.status, detail: text.slice(0, 300) };
          if (bodyLooksRetriable(text)) {
            logEvent("retry-body", { tag: opts.tag, model, attempt: i + 1, attempts, status: res.status, latencyMs: latency });
            if (i < attempts - 1 && Date.now() < globalDeadline) await sleep(backoffMs(i));
            continue;
          }
          // 4xx não-retriable (auth, schema inválido, etc.) — propaga imediatamente
          logEvent("hard-fail", { tag: opts.tag, model, attempt: i + 1, status: res.status, latencyMs: latency });
          throw new GeminiError(res.status, text.slice(0, 500), totalAttempts, model);
        }

        // 200 OK — checa finishReason
        try {
          const parsed = JSON.parse(text);
          const fr = parsed?.candidates?.[0]?.finishReason as string | undefined;
          if (fr && fr !== "STOP" && fr !== "MAX_TOKENS") {
            lastError = { status: 200, detail: `finishReason=${fr}` };
            logEvent("bad-finish", { tag: opts.tag, model, attempt: i + 1, attempts, finishReason: fr, latencyMs: latency });
            if (i < attempts - 1 && Date.now() < globalDeadline) {
              await sleep(backoffMs(i));
              continue;
            }
            // último attempt do tier com finishReason ruim → cai pro próximo tier
            return "EXHAUSTED";
          }
        } catch {
          // não é JSON envelope; se schema foi pedido vai falhar depois, deixa passar
        }

        logEvent("ok", { tag: opts.tag, model, attempt: i + 1, latencyMs: latency });
        return { res, text };
      } catch (e) {
        isAbort = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
        const latency = Date.now() - t0;
        if (e instanceof GeminiError) throw e; // hard-fail propagado acima
        const msg = e instanceof Error ? e.message : String(e);
        lastError = { status: isAbort ? 504 : 0, detail: msg.slice(0, 300) };
        logEvent(isAbort ? "timeout" : "net-error", { tag: opts.tag, model, attempt: i + 1, attempts, latencyMs: latency, msg });
        if (i < attempts - 1 && Date.now() < globalDeadline) {
          await sleep(backoffMs(i));
        }
      }
    }
    return "EXHAUSTED";
  };

  // Cascata: primary → mid → fallback
  const tiers: Array<{ model: string; attempts: number; timeout: number }> = [
    { model: primary, attempts: Math.max(1, opts.primaryAttempts ?? 2), timeout: opts.timeoutMs ?? 35000 },
    { model: mid, attempts: Math.max(1, opts.midAttempts ?? 2), timeout: opts.midTimeoutMs ?? 30000 },
    { model: fallback, attempts: Math.max(1, opts.fallbackAttempts ?? 3), timeout: opts.fallbackTimeoutMs ?? 25000 },
  ];

  let usedModel = primary;
  let success: { res: Response; text: string } | null = null;

  for (const tier of tiers) {
    if (Date.now() >= globalDeadline) {
      logEvent("deadline-skip", { tag: opts.tag, skipping: tier.model });
      continue;
    }
    usedModel = tier.model;
    const r = await tryTier(tier.model, tier.attempts, tier.timeout);
    if (r !== "EXHAUSTED" && r !== "DEADLINE") {
      success = r;
      break;
    }
    logEvent("tier-fail", { tag: opts.tag, model: tier.model, reason: r });
  }

  const latencyMs = Date.now() - startedAt;

  if (!success) {
    const detail = lastError ? `${lastError.status}: ${lastError.detail}` : "no upstream response";
    logEvent("all-tiers-failed", { tag: opts.tag, totalAttempts, latencyMs, lastError });
    throw new GeminiError(lastError?.status || 503, `All Gemini tiers failed (${totalAttempts} attempts): ${detail}`, totalAttempts, usedModel);
  }

  const { text } = success;
  let envelope: unknown;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new GeminiError(502, "Gemini retornou body não-JSON", totalAttempts, usedModel);
  }
  const extractedText = extractTextFromEnvelope(envelope);

  if (typeof extractedText !== "string") {
    console.error(`[${opts.tag}] unexpected envelope`, JSON.stringify(envelope).slice(0, 600));
    throw new GeminiError(502, "Gemini retornou envelope sem text", totalAttempts, usedModel);
  }

  if (opts.schema) {
    try {
      return { json: parseLooseJson(extractedText), modelUsed: usedModel, latencyMs, attempts: totalAttempts };
    } catch (e) {
      console.warn(`[${opts.tag}] failed to parse JSON; trying repair`, { sample: extractedText.slice(0, 400), err: String(e) });
      const canRepair = globalDeadline - Date.now() >= 5000;
      if (canRepair) totalAttempts++;
      const repaired = await repairJsonWithGemini({
        apiKey: opts.apiKey,
        rawText: extractedText,
        schema: opts.schema,
        tag: opts.tag,
        remainingMs: Math.max(5000, globalDeadline - Date.now()),
      });
      if (repaired) {
        return { json: repaired, modelUsed: `${usedModel}+json-repair`, latencyMs: Date.now() - startedAt, attempts: totalAttempts };
      }
      throw new GeminiError(502, "A IA respondeu em formato JSON inválido", totalAttempts, usedModel);
    }
  }
  return { text: extractedText, modelUsed: usedModel, latencyMs, attempts: totalAttempts };
}

// Streaming nativo (para ai-chat). Devolve Response com SSE compatível.
export async function callGeminiStream(opts: {
  apiKey: string;
  systemInstruction?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  model?: string;
  maxOutputTokens?: number;
  tag: string;
}): Promise<Response> {
  const model = opts.model ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${opts.apiKey}`;

  const contents = opts.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: opts.maxOutputTokens ?? 1500 },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
