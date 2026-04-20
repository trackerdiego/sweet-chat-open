

# Atualizar modelos Gemini — fallback obsoleto + erro de formatação

## Diagnóstico da outra IA: parcialmente certa

**Certo:**
- O escudo (retry 3x + fallback) está funcionando — os logs anteriores comprovam.
- `gemini-2.0-flash` como reserva pode estar instável/restrito em algumas contas.
- `gemini-1.5-flash` é mais estável e tolerante.

**Cuidado (não vou seguir cego):**
- Os comandos `cp -r` + `docker compose up -d --force-recreate functions` que ela sugere **não são o seu fluxo**. Você usa `./scripts/deploy-selfhost.sh` (que roda `supabase functions deploy`). Misturar os dois métodos pode bagunçar o estado das functions.
- Eu não vou rodar `sed` na sua VPS — vou alterar os arquivos aqui no Lovable (3 functions), commitar pro GitHub, e você roda o deploy script normal.

## O que vou mudar (3 arquivos, 1 linha cada)

Em `generate-script/index.ts`, `generate-daily-guide/index.ts`, `generate-tools-content/index.ts`:

```ts
const FALLBACK_MODEL = "gemini-2.0-flash";  // antes
const FALLBACK_MODEL = "gemini-1.5-flash";  // depois
```

Mantenho `gemini-2.5-flash` como primário (é mais novo e capaz). Só troco o fallback. Se depois o 2.5 continuar instável, fazemos uma 2ª rodada trocando o primário também — mas um passo por vez.

## Sobre o erro "MALFORMED_FUNCTION_CALL" no script

Isso aparece quando o Gemini retorna o tool call com JSON quebrado. Já temos `parseLooseJson` resiliente nas 3 functions, mas o `gemini-1.5-flash` **respeita melhor o schema do tool calling** que o 2.0 — então trocar o fallback também ajuda nesse erro indiretamente.

Se o erro persistir mesmo após o deploy, próxima ação seria simplificar o schema da tool (reduzir `required` fields), mas só faço isso se confirmarmos pelos logs.

## Arquivos tocados

1. `supabase/functions/generate-script/index.ts` — linha 31 (`FALLBACK_MODEL`)
2. `supabase/functions/generate-daily-guide/index.ts` — linha 31 (`FALLBACK_MODEL`)
3. `supabase/functions/generate-tools-content/index.ts` — equivalente

Nada mais muda. Sem mexer em prompts, retry, schema, DB, frontend.

## Atualização de memória

`mem://infra/deploy-workflow.md` — atualizar a nota:
> Fallback de IA: `gemini-2.5-flash` → `gemini-1.5-flash` (não usar `2.0-flash`, restrito em algumas contas).

## Deploy na VPS (bloco copia-e-cola)

Você já tem as variáveis exportadas da última sessão? Se sim:

```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh
```

Se não tem mais (sessão SSH nova), antes:

```bash
export SUPABASE_ACCESS_TOKEN="seu-token"
export PROJECT_REF="default"
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh
```

**Não rode os comandos `cp -r` + `force-recreate` que a outra IA sugeriu.** Seu fluxo oficial é o `deploy-selfhost.sh`.

## Validação após deploy

```bash
docker compose -f ~/supabase/docker/docker-compose.yml logs functions --since 3m 2>&1 | grep -iE "gemini-1.5-flash|fallback|attempt" | tail -20
```

Esperado nos logs após teste:
- Se 2.5 funcionar de primeira: log normal, sucesso direto.
- Se 2.5 falhar: `Primary model gemini-2.5-flash exhausted, falling back to gemini-1.5-flash` → depois `gemini responded status: 200`.

## Resultado esperado

- Tools: continua estável.
- Script: passa de "às vezes" pra "quase sempre" (fallback agora funciona de verdade).
- Daily Guide: passa de "nunca" pra "quase sempre".
- Erros restantes = problema upstream real do Google, com mensagem clara.

