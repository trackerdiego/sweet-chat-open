

# Plano: schemas mais leves + timeout maior + ordem de fallback inteligente

## Diagnóstico (logs novos, pós-restart)

Os logs com `1.5-flash`/`2.0-flash` são **antigos** (do buffer pré-restart). O código no repo já está correto:

| Function | Primary | Fallback |
|---|---|---|
| script | 2.5-flash | 2.5-flash |
| matrix | 2.5-flash | 2.5-flash |
| audience-profile | 2.5-pro | 2.5-flash |
| daily-guide | 2.5-pro | 2.5-flash |
| tools-content | 2.5-pro | 2.5-flash |

**Problemas reais nos logs novos:**

1. **`audience-step2` timeout 3x no `2.5-pro`** (60s não basta — pro é lento com schema grande)
2. **`matrix` 503 no `2.5-flash`** (Google sobrecarregado momentaneamente)
3. **`daily-guide` e `tools-content` ainda MALFORMED no `2.5-flash`** quando caem no fallback (pro funciona, flash quebra)

## Plano em 3 partes

### Parte 1 — Aumentar timeout pro `2.5-pro` (60s → 120s)

`gemini-2.5-pro` com tool schema pesado leva 40-90s pra responder. 60s tá cortando ele no meio. Subir pra 120s nas 3 functions que usam pro como primário:

- `generate-audience-profile/index.ts`
- `generate-daily-guide/index.ts`
- `generate-tools-content/index.ts`

Mudança: `callGeminiResilient(..., timeoutMs = 120000)`

### Parte 2 — Inverter lógica do fallback nas 2 functions com schema pesado

`daily-guide` e `tools-content` têm schemas que **só o pro tolera**. Cair pro flash no fallback é garantia de MALFORMED. Trocar fallback pra **outra tentativa do mesmo pro** (mais 3 retries) em vez de degradar pro flash:

- `generate-daily-guide/index.ts`: `FALLBACK_MODEL = "gemini-2.5-pro"`
- `generate-tools-content/index.ts`: `FALLBACK_MODEL = "gemini-2.5-pro"`
- `generate-audience-profile/index.ts`: `FALLBACK_MODEL = "gemini-2.5-pro"`

Total efetivo: 6 tentativas no pro (3 + 3) antes de desistir. Bem melhor que cair num modelo que sempre vai falhar.

### Parte 3 — Manter `matrix` e `script` como estão

Esses 2 funcionam bem no `2.5-flash` (schema mais simples). Os 503 são transientes do Google — o retry de 3x já cobre. Sem mudança.

## Bloco de deploy (depois da aprovação)

```bash
cd /root/app
git checkout -- supabase/functions/
git pull origin main
cp -r supabase/functions/generate-audience-profile \
      supabase/functions/generate-daily-guide \
      supabase/functions/generate-tools-content \
      ~/supabase/docker/volumes/functions/
docker compose -f ~/supabase/docker/docker-compose.yml restart functions
```

(Não preciso copiar `script` e `matrix` — não mudam.)

## Validação

```bash
docker compose -f ~/supabase/docker/docker-compose.yml logs functions --follow 2>&1 \
  | grep -iE "audience|matrix|daily-guide|tools-content|gemini|fallback|MALFORMED|timeout|404|503"
```

Esperado:
- Zero MALFORMED em `daily-guide`/`tools-content` (não cai mais pro flash)
- Menos timeouts em `audience-step2` (120s dá margem pro pro responder)
- Onboarding completo verde

## O que NÃO vou fazer

- Não vou simplificar schemas (custa muito esforço; aumentar timeout + manter pro resolve)
- Não vou mexer em `script`/`matrix` (funcionam)
- Não vou mexer no frontend
- Não vou mexer no `deploy-selfhost.sh` agora

