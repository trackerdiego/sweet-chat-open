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

const RETRIABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const ALLOWED_MODELS = new Set([
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  prompt: string;
  schema?: object; // se presente, força JSON estruturado via responseSchema
  model?: string; // default gemini-2.5-flash
  fallbackModel?: string; // default gemini-2.5-flash-lite (NÃO pro)
  timeoutMs?: number; // default 90000
  maxOutputTokens?: number; // default 8192
  temperature?: number;
  tag: string;
};

export type GeminiResult = {
  // Se schema foi passado: JSON parseado já pronto. Se não: texto puro.
  json?: unknown;
  text?: string;
  modelUsed: string;
  latencyMs: number;
};

export class GeminiError extends Error {
  constructor(public status: number, public detail: string) {
    super(`Gemini ${status}: ${detail}`);
  }
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

export async function callGeminiNative(opts: GeminiOptions): Promise<GeminiResult> {
  const model = opts.model ?? "gemini-2.5-flash";
  const fallback = opts.fallbackModel ?? "gemini-2.5-flash-lite";
  const timeoutMs = opts.timeoutMs ?? 90000;

  if (!ALLOWED_MODELS.has(model) || !ALLOWED_MODELS.has(fallback)) {
    console.error(`[${opts.tag}] BOOT GUARD: modelo não permitido`, { model, fallback });
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
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig,
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  const delays = [2000, 5000, 12000];
  const tryModel = async (m: string): Promise<{ res: Response; text: string } | null> => {
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      try {
        const res = await callOnce(m, body, opts.apiKey, timeoutMs);
        if (RETRIABLE_STATUSES.has(res.status)) {
          console.warn(`[${opts.tag}] ${res.status} on ${m} attempt ${i + 1}/3 (${Date.now() - t0}ms)`);
          try { await res.text(); } catch { /* ignore */ }
        } else {
          const text = await res.text();
          // Detecta finish_reason ruim mesmo com 200 (raro no nativo, mas possível)
          try {
            const parsed = JSON.parse(text);
            const fr = parsed?.candidates?.[0]?.finishReason as string | undefined;
            if (fr && fr !== "STOP" && fr !== "MAX_TOKENS") {
              console.warn(`[${opts.tag}] bad finishReason=${fr} on ${m} attempt ${i + 1}/3`);
              if (i < 2) { await sleep(delays[i] + Math.floor(Math.random() * 400)); continue; }
            }
          } catch { /* not JSON envelope, deixa passar */ }
          return { res, text };
        }
      } catch (e) {
        const isAbort = e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
        console.warn(`[${opts.tag}] ${isAbort ? "timeout" : "network error"} on ${m} attempt ${i + 1}/3`, e instanceof Error ? e.message : e);
        if (i === 2 && !isAbort) throw e;
      }
      if (i < 2) await sleep(delays[i] + Math.floor(Math.random() * 400));
    }
    return null;
  };

  const startedAt = Date.now();
  let used = model;
  let result = await tryModel(model);
  if (!result) {
    console.warn(`[${opts.tag}] primary ${model} exhausted, falling back to ${fallback}`);
    used = fallback;
    result = await tryModel(fallback);
  }
  const latencyMs = Date.now() - startedAt;

  if (!result) {
    throw new GeminiError(503, "All Gemini attempts failed (primary + fallback)");
  }

  const { res, text } = result;
  if (!res.ok) {
    throw new GeminiError(res.status, text.slice(0, 500));
  }

  const envelope = JSON.parse(text);
  const partText = envelope?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof partText !== "string") {
    console.error(`[${opts.tag}] unexpected envelope`, JSON.stringify(envelope).slice(0, 600));
    throw new GeminiError(502, "Gemini retornou envelope sem text");
  }

  if (opts.schema) {
    try {
      return { json: parseLooseJson(partText), modelUsed: used, latencyMs };
    } catch (e) {
      console.error(`[${opts.tag}] failed to parse JSON`, { sample: partText.slice(0, 400), err: String(e) });
      throw new GeminiError(502, "Gemini retornou JSON inválido");
    }
  }
  return { text: partText, modelUsed: used, latencyMs };
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
