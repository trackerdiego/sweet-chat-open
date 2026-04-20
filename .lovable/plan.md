

# 2 problemas reais nos logs — fallback errado + tool schema rejeitado

## Diagnóstico (logs comprovam)

### Problema A: fallback `gemini-1.5-flash` não existe no endpoint OpenAI-compat
```
[Error] AI error: 404
"models/gemini-1.5-flash is not found for API version v1main, or is not supported for generateContent"
```

A "outra IA" mandou trocar pra `gemini-1.5-flash` baseada em conhecimento do **endpoint nativo do Google**. Mas nosso código usa `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` (camada de compatibilidade OpenAI). Nesse endpoint, **só existem modelos da família 2.x** (`gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`). O 1.5 foi removido dessa camada.

**Resultado**: meu "escudo" tenta o primário 3x → tenta o fallback → fallback retorna 404 imediato → onboarding morre. **Pior que antes do escudo.**

### Problema B: `MALFORMED_FUNCTION_CALL` em `daily-guide` e `tools-content`
```
"finish_reason":"function_call_filter: MALFORMED_FUNCTION_CALL"
"completion_tokens":0
```

O `gemini-2.5-flash` está abortando antes de gerar qualquer token porque o tool schema dessas 2 functions está disparando o filtro de segurança do Gemini. Isso é **bug conhecido do 2.5-flash com schemas complexos** (arrays aninhados, `additionalProperties: false`, muitos `required`). Com 0 tokens de output, não há o que parsear → erro `no tool_calls in response`.

`audience-profile` e `personalized-matrix` não dão MALFORMED porque usam `gemini-2.5-pro` (mais tolerante).

## Plano de correção

### Fix 1: trocar fallback pra modelo que EXISTE no endpoint OpenAI-compat

Trocar `FALLBACK_MODEL = "gemini-1.5-flash"` por `gemini-2.0-flash` nas 5 functions. O 2.0-flash existe no endpoint, é mais rápido e barato que o 2.5, e historicamente menos sujeito ao MALFORMED filter.

Arquivos:
- `supabase/functions/generate-script/index.ts`
- `supabase/functions/generate-daily-guide/index.ts`
- `supabase/functions/generate-tools-content/index.ts`
- `supabase/functions/generate-audience-profile/index.ts`
- `supabase/functions/generate-personalized-matrix/index.ts`

Mudança trivial (1 linha por arquivo).

### Fix 2: tratar MALFORMED_FUNCTION_CALL como retriable + cair pro fallback imediato

No `callGeminiResilient`, depois de receber resposta 200 OK, inspecionar:
- Se `finish_reason === "MALFORMED_FUNCTION_CALL"` ou começa com `function_call_filter:` → tratar como falha e tentar novamente (e eventualmente fallback).

Isso garante que quando 2.5-flash bugar com schema, o código pula pro 2.0-flash sem falhar a request inteira.

### Fix 3: simplificar tool schemas das 2 functions problemáticas (opcional, depois de validar Fix 1+2)

Se 2.0-flash também der MALFORMED em `daily-guide` / `tools-content`, aí sim simplificar o schema (remover `additionalProperties: false`, achatar arrays aninhados). Não vou fazer agora — Fix 1+2 provavelmente já resolve.

### Fix 4: corrigir o `scripts/deploy-selfhost.sh` (separado, depois)

O script usa `supabase link` + `functions deploy` que não funciona em self-hosted. Fluxo correto é o que você acabou de rodar manualmente: `git pull` + `cp -r` + `docker compose restart functions`. Reescrevo num próximo passo, **depois** de confirmar que os fixes acima funcionam.

## O que NÃO vou fazer

- Não vou voltar pra `gemini-1.5-flash` (não existe no endpoint).
- Não vou trocar o primário pra 2.0 (2.5-flash funciona na maioria dos casos; só preciso do fallback robusto).
- Não vou mexer em RLS, schema, frontend.
- Não vou fingir que entendi tudo de primeira — eu já errei (mandei 1.5-flash baseado no que parecia padrão Google, sem verificar o endpoint específico). Esse plano é baseado nos logs reais.

## Bloco de deploy (depois da aprovação)

Mesmo padrão que acabou de funcionar:

```bash
cd /root/app
git checkout -- supabase/functions/
git pull origin main
cp -r supabase/functions/generate-audience-profile \
      supabase/functions/generate-personalized-matrix \
      supabase/functions/generate-script \
      supabase/functions/generate-daily-guide \
      supabase/functions/generate-tools-content \
      ~/supabase/docker/volumes/functions/
docker compose -f ~/supabase/docker/docker-compose.yml restart functions
```

Validação:
```bash
docker compose -f ~/supabase/docker/docker-compose.yml logs functions --follow 2>&1 \
  | grep -iE "audience|matrix|daily-guide|gemini|fallback|MALFORMED|error"
```

Depois testa onboarding completo no app. Esperado: passos verdes, ou (no pior caso) log mostrando `falling back to gemini-2.0-flash` → sucesso.

