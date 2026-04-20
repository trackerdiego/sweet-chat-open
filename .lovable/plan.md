

# Plano: tirar o `matrix` do `2.5-flash` (que está dando 503 contínuo)

## Diagnóstico confirmado pelos logs

```
[matrix] boot { PRIMARY_MODEL: "gemini-2.5-flash", FALLBACK_MODEL: "gemini-2.5-flash", TIMEOUT_MS: 90000 }
[matrix] Gemini 503 on gemini-2.5-flash attempt 1/3
[matrix] Gemini 503 on gemini-2.5-flash attempt 2/3
[matrix] Gemini 503 on gemini-2.5-flash attempt 3/3
[matrix] Primary model gemini-2.5-flash exhausted, falling back to gemini-2.5-flash
[matrix] Gemini 503 on gemini-2.5-flash attempt 1/3
[matrix] Gemini timeout on gemini-2.5-flash attempt 2/3
```

O que isso significa:
- ✅ Boot config correta (`gemini-2.5-flash`, sem fallback inválido)
- ✅ Zero `404` de modelo deprecado
- ❌ O `gemini-2.5-flash` no endpoint OpenAI-compat do Google (`/v1beta/openai/...`) está **indisponível ou throttled** pra esse tamanho de prompt (matriz de 30 dias é grande)
- ❌ Cair no fallback do mesmo modelo é inútil — só perde tempo

`tools-content`, `daily-guide` e `audience-profile` (que rodam no `2.5-pro`) **não aparecem mais nos logs com erro** — então estão funcionando.

## Solução

Trocar `matrix` pra `gemini-2.5-pro` como **fallback** (mantendo `2.5-flash` como primário pra continuar barato/rápido quando o Google não estiver dando 503). Assim:

1. Tenta `2.5-flash` 3x (rápido e barato)
2. Se der 503/timeout, **cai pro `2.5-pro`** (mais robusto, mais caro, mas não 503)
3. `2.5-pro` 3x
4. Só falha se ambos morrerem

## O que será alterado

### `supabase/functions/generate-personalized-matrix/index.ts`

```diff
- const PRIMARY_MODEL = "gemini-2.5-flash";
- const FALLBACK_MODEL = "gemini-2.5-flash";
- const TIMEOUT_MS = 90000;
+ const PRIMARY_MODEL = "gemini-2.5-flash";
+ const FALLBACK_MODEL = "gemini-2.5-pro";  // pro como rede de segurança
+ const TIMEOUT_MS = 120000;                // pro precisa de mais tempo
```

E nada mais. Schema, prompt, lógica — tudo permanece.

### `supabase/functions/generate-script/index.ts`
Mesma mudança preventiva (também usa `2.5-flash`):
```diff
- const FALLBACK_MODEL = "gemini-2.5-flash";
- const TIMEOUT_MS = 60000;
+ const FALLBACK_MODEL = "gemini-2.5-pro";
+ const TIMEOUT_MS = 90000;
```

## Bloco de deploy pra VPS

```bash
cd /root/app
git checkout -- supabase/functions/
git pull origin main
cp -r supabase/functions/generate-personalized-matrix \
      supabase/functions/generate-script \
      ~/supabase/docker/volumes/functions/
docker compose -f ~/supabase/docker/docker-compose.yml restart functions
```

## Validação

```bash
docker compose -f ~/supabase/docker/docker-compose.yml logs functions --since 10s --follow 2>&1 \
  | grep -iE "boot|matrix|503|fallback|gemini-2.5"
```

Esperado:
- `[matrix] boot { PRIMARY_MODEL: "gemini-2.5-flash", FALLBACK_MODEL: "gemini-2.5-pro", TIMEOUT_MS: 120000 }`
- Se der 503 no flash: `falling back to gemini-2.5-pro` → e completar com sucesso

## Critério de sucesso
- Onboarding termina os 4 passos verdes
- Matriz é gravada em `user_strategies`

## O que NÃO vou fazer
- Não vou implementar fila/worker assíncrono (overengineering pra esse caso — `2.5-pro` resolve)
- Não vou mexer em `audience-profile`, `daily-guide`, `tools-content` (estão OK pelos logs)
- Não vou mudar prompt nem schema do matrix

