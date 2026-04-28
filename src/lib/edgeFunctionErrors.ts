const GENERIC_EDGE_ERROR = 'Edge Function returned a non-2xx status code';

function extractMessageFromBody(body: unknown): string | null {
  if (!body) return null;
  if (typeof body === 'string') {
    try {
      return extractMessageFromBody(JSON.parse(body)) || body;
    } catch {
      return body;
    }
  }
  if (typeof body === 'object') {
    const record = body as Record<string, unknown>;
    for (const key of ['error', 'msg', 'message', 'detail']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return null;
}

export async function getEdgeFunctionErrorMessage(error: unknown, fallback = 'Falha ao chamar função do servidor'): Promise<string> {
  const baseMessage = error instanceof Error ? error.message : fallback;

  try {
    const context = (error as { context?: unknown })?.context;

    if (context instanceof Response) {
      const text = await context.clone().text();
      const parsed = extractMessageFromBody(text);
      if (parsed) return parsed;
    }

    if (context && typeof context === 'object') {
      const bodyMessage = extractMessageFromBody((context as { body?: unknown }).body);
      if (bodyMessage) return bodyMessage;

      const jsonFn = (context as { json?: () => Promise<unknown> }).json;
      if (typeof jsonFn === 'function') {
        const json = await jsonFn.call(context);
        const parsed = extractMessageFromBody(json);
        if (parsed) return parsed;
      }

      const textFn = (context as { text?: () => Promise<string> }).text;
      if (typeof textFn === 'function') {
        const text = await textFn.call(context);
        const parsed = extractMessageFromBody(text);
        if (parsed) return parsed;
      }
    }
  } catch {
    // Mantém fallback seguro abaixo.
  }

  if (!baseMessage || baseMessage === GENERIC_EDGE_ERROR) return fallback;
  return baseMessage;
}

export async function createEdgeFunctionError(error: unknown, fallback?: string): Promise<Error> {
  return new Error(await getEdgeFunctionErrorMessage(error, fallback));
}

export async function getResponseErrorMessage(response: Response, fallback = 'Falha ao consultar status da geração'): Promise<string> {
  try {
    const text = await response.clone().text();
    const parsed = extractMessageFromBody(text);
    if (parsed) return parsed;
  } catch {
    // Mantém fallback seguro abaixo.
  }
  return fallback;
}
