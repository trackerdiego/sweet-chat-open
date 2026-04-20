

# IAs lentas + 504 Gateway Timeout — diagnóstico e correção em 2 frentes

## O que os logs/screenshot provam

Do screenshot você compartilhou:
- `POST /functions/v1/generate-script` → **504 Gateway Timeout** (2x)
- `POST /functions/v1/generate-daily-guide` → **504 Gateway Timeout**
- O AI chat funciona mas demora demais e devolve um bloco gigante sem formatação

E do código que já li:
- `generate-script/index.ts` tem timeout interno de **90s** com 1 retry → na prática até **180s** numa request, mas o **Kong** (gateway) tem limite muito menor
- O Kong default do Supabase self-hosted devolve 504 em **~60s**
- O Gemini 2.5-flash com prompts viscerais grandes (system + user + tool schema) leva facilmente 30–90s
- `AiChat.tsx` provavelmente renderiza markdown como texto puro

## Diagnóstico (2 problemas independentes)

### Problema 1 — 504 nas IAs (`generate-script`, `generate-daily-guide`, `generate-tools-content`)

**Causa**: o **Kong** do self-hosted está cortando a request antes do Gemini responder. Não é a edge function que está quebrada — ela ainda está processando quando o Kong já devolveu 504 ao browser. Por isso "funciona uma vez e falha na segunda": a primeira chamada pega o Gemini frio mas rápido; a segunda já cai num prompt mais pesado (ex: visceral profile carregado) e estoura os 60s do Kong.

**Evidência adicional**: nos meus smoke tests anteriores, `hello` (instantâneo) → 200, mas as IAs nunca foram testadas com payload real — só com 401.

### Problema 2 — AI Chat sem formatação e devolvendo bloco gigante

**Causa**: `AiChat.tsx` renderiza o conteúdo como string crua, não como markdown. Gemini formata com `**bold**`, `##` e listas, mas isso aparece como texto literal. Além disso, sem `max_tokens` controlado, sugestões tipo "5 reels para semana" puxam respostas de 2000+ tokens.

## Plano de correção

### Fase 1 — Aumentar timeout do Kong (resolve 504)

O `kong.yml` no self-hosted tem rotas pra `/functions/v1/*`. Preciso adicionar/ajustar `connect_timeout`, `write_timeout`, `read_timeout` pra **300000ms** (5min) na rota das functions.

Vou te entregar:
1. Patch no `~/supabase/docker/volumes/api/kong.yml` (heredoc pronto)
2. `docker compose restart kong`
3. Smoke test refazendo a chamada de `generate-script` com JWT real (via app)

**Por que 300s e não infinito**: Gemini 2.5-flash raramente passa de 90s; 300s dá folga sem deixar requests órfãs travadas.

### Fase 2 — Reduzir tempo das próprias functions (defesa em profundidade)

No `generate-script/index.ts`, `generate-daily-guide/index.ts` e `generate-tools-content/index.ts`:
- Reduzir `timeoutMs` interno do Gemini de 90s pra **60s** (corta cauda longa)
- Manter o 1 retry mas com timeout total ≤ 120s
- Adicionar `max_tokens: 2000` na chamada do Gemini pra evitar respostas gigantes
- Logar `latencyMs` (já existe em script, replicar nas outras 2)

### Fase 3 — AI Chat: markdown + resposta menor

Em `src/components/AiChat.tsx`:
- Instalar/usar `react-markdown` (provavelmente já está no projeto via `@/components/ui` — verifico)
- Renderizar `message.content` com `<ReactMarkdown>` em vez de string crua
- Adicionar classes `prose prose-sm dark:prose-invert` pro Tailwind formatar
- No `ai-chat/index.ts`, adicionar instrução no system prompt: "responda de forma concisa, use listas curtas, máximo 400 palavras por resposta" e `max_tokens: 1500`

### Fase 4 — Validação
1. Você abre `/script` e gera 2x seguidas → não deve dar 504
2. Você abre `/tasks` → guia diário carrega
3. Você abre `/tools` → ferramentas IA respondem
4. AI chat → clica numa sugestão → resposta formatada com listas/negrito

## Arquivos que vou tocar (no Lovable)

| Arquivo | Mudança | Risco |
|---|---|---|
| `supabase/functions/generate-script/index.ts` | timeout 90→60s, max_tokens | baixo |
| `supabase/functions/generate-daily-guide/index.ts` | timeout, max_tokens, retry | baixo |
| `supabase/functions/generate-tools-content/index.ts` | timeout, max_tokens, retry | baixo |
| `supabase/functions/ai-chat/index.ts` | system prompt + max_tokens | baixo |
| `src/components/AiChat.tsx` | render markdown | baixo |

## O que VOCÊ vai precisar fazer na VPS

Bloco copia-e-cola que vou te entregar:
1. Patch no `kong.yml` aumentando timeouts da rota `/functions/v1/*`
2. `docker compose restart kong`
3. Pull do código novo das edge functions + `rsync` (sem `--delete`!) + `docker compose restart functions`

## O que NÃO vou fazer

- Não vou implementar fila/polling assíncrono ainda — é overengineering pro problema real (Kong timeout). Se mesmo com 5min ainda estourar, aí sim partimos pra `EdgeRuntime.waitUntil` + polling.
- Não vou trocar Gemini 2.5-flash por modelo mais rápido — é o melhor custo/qualidade pro caso de uso visceral.
- Não vou mexer em `main/`, `hello/` ou volume de functions.
- Não vou tocar em outras functions que estão saudáveis.

## Próximo passo

Quando aprovar, em modo default eu:
1. Edito os 5 arquivos acima
2. Te entrego **um bloco único** pra colar na VPS com: patch do `kong.yml` + restart kong + deploy das functions
3. Você testa e me reporta

