# Fallback Gemini corrigido + escudo MALFORMED_FUNCTION_CALL

## Mudanças aplicadas nas 5 functions

1. `FALLBACK_MODEL` trocado de `gemini-1.5-flash` (404 no endpoint OpenAI-compat) para `gemini-2.0-flash` (existe e é estável).
2. `tryModel` agora detecta `finish_reason === "MALFORMED_FUNCTION_CALL"` (ou `function_call_filter:*`) em respostas 200 OK e trata como falha → retry → fallback automático pro `gemini-2.0-flash`.

Arquivos:
- `supabase/functions/generate-script/index.ts`
- `supabase/functions/generate-daily-guide/index.ts`
- `supabase/functions/generate-tools-content/index.ts`
- `supabase/functions/generate-audience-profile/index.ts`
- `supabase/functions/generate-personalized-matrix/index.ts`

## Deploy VPS

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

## Validação

```bash
docker compose -f ~/supabase/docker/docker-compose.yml logs functions --follow 2>&1 \
  | grep -iE "audience|matrix|daily-guide|gemini|fallback|MALFORMED|error"
```

Esperado:
- Sucesso direto OU
- Log `Gemini MALFORMED_FUNCTION_CALL on gemini-2.5-flash` → `falling back to gemini-2.0-flash` → sucesso.

Depois testa: refazer onboarding / regenerar matriz.
