
Corrigir as falhas persistentes de IA em `generate-daily-guide` e `generate-script` com a abordagem mais conservadora possível, priorizando estabilidade do app e evitando mudanças amplas que possam degradar o que já funciona.

## Leitura do problema

Hoje há dois sinais importantes:

1. `generate-daily-guide` e `generate-script` estão retornando `500`
2. O backend real é **self-hosted** e, neste projeto, **restart de container não equivale a deploy de código**

Pelo estado atual do código e da memória do projeto, a causa mais provável é uma combinação de:
- código novo do Lovable **não aplicado de verdade** no self-hosted
- `generate-script` ainda está no fluxo antigo e frágil
- contagem de uso ainda está duplicada no frontend em algumas telas
- tratamento de erro inconsistente entre funções

## Estratégia segura

Vou seguir um plano em duas fases, com foco em risco baixo.

### Fase 1 — Estabilizar sem refatoração grande

#### 1. Confirmar e alinhar o método correto de deploy self-hosted
O projeto documenta que o deploy real das edge functions é manual via `scripts/deploy-selfhost.sh`, não apenas `docker compose restart functions`.

Vou preparar a correção considerando este fluxo:
- aplicar mudanças só nas functions afetadas
- orientar deploy real das functions privadas
- só depois validar no app

Objetivo: evitar “achar que subiu” quando na prática o servidor continua rodando código antigo.

#### 2. Endurecer `generate-script` no mesmo padrão de robustez do `generate-daily-guide`
Arquivo:
- `supabase/functions/generate-script/index.ts`

Mudanças:
- adicionar helper de timeout + retry com `AbortController`
- só contabilizar uso **após sucesso real**
- tratar melhor respostas 429, 402, 5xx e timeout
- adicionar logs estruturados:
  - início da execução
  - status da resposta do modelo
  - latência
  - shape da resposta quando `tool_calls` vier vazio
- padronizar retorno JSON com mensagens claras

Isso elimina a diferença atual entre Daily Guide e Script e reduz o risco de 500 genérico.

#### 3. Tornar o parse das respostas de IA mais resiliente
Arquivos:
- `supabase/functions/generate-daily-guide/index.ts`
- `supabase/functions/generate-script/index.ts`
- `supabase/functions/generate-tools-content/index.ts`

Mudanças:
- manter tool calling
- além do parse normal de `tool_calls`, adicionar fallback defensivo para:
  - argumentos vindos como string inválida
  - resposta com markdown/code fence
  - caracteres de controle
  - JSON com vírgulas sobrando
- se a resposta vier truncada ou sem estrutura, retornar `502` com mensagem clara, nunca `500` genérico

Objetivo: se o modelo falhar na formatação, o app continua previsível e o erro fica diagnosticável.

#### 4. Corrigir cobrança/consumo duplicado no frontend
Arquivos:
- `src/components/ScriptGenerator.tsx`
- `src/pages/Tools.tsx`

Hoje o backend já contabiliza uso, mas o frontend ainda chama `incrementUsage(...)` em sucesso.
Vou remover essa duplicidade nas rotas onde a edge function já faz a contagem.

Impacto:
- evita desencontro entre UI e backend
- reduz risco de parecer que “gastou uso sem funcionar”
- preserva a regra de negócio existente

#### 5. Melhorar feedback no frontend do Script
Arquivo:
- `src/components/ScriptGenerator.tsx`

Mudanças:
- espelhar o tratamento de erro já usado em `DailyGuide`
- ler `error.context.status` e `error.context.body`
- mapear mensagens específicas para:
  - 401
  - 402
  - 429
  - 502
  - 504
  - 500
- registrar `console.error` com o objeto completo

Objetivo: parar de mostrar “Tente novamente” para erros diferentes.

## O que NÃO vou mexer agora

Para manter o app estável, não vou:
- trocar o provedor de IA
- refatorar o fluxo para jobs assíncronos
- mexer em `ai-chat`, `generate-personalized-matrix` ou onboarding
- alterar schema do banco
- mudar a lógica principal das páginas

A ideia é corrigir o mínimo necessário, no menor raio de impacto possível.

## Arquivos afetados

- `supabase/functions/generate-script/index.ts`
- `supabase/functions/generate-daily-guide/index.ts`
- `supabase/functions/generate-tools-content/index.ts`
- `src/components/ScriptGenerator.tsx`
- `src/pages/Tools.tsx`

## Validação após implementação

### Backend
Validar que:
- `generate-script` responde com sucesso ou erro explícito, sem `500` genérico
- `generate-daily-guide` retorna `502/504/429/402` quando aplicável
- uso só é contabilizado após sucesso

### Frontend
Validar que:
- tela Tarefas mostra erro específico
- tela Script mostra erro específico
- Ferramentas continuam funcionando sem regressão
- botão volta ao estado normal após falha
- UI não quebra nem entra em loading infinito

## Deploy real no self-hosted

Depois da implementação, o deploy precisa seguir o fluxo real do projeto, não só restart:

```bash
export SUPABASE_ACCESS_TOKEN=<token>
export PROJECT_REF=<ref-do-self-hosted>
./scripts/deploy-selfhost.sh
```

Se você preferir deploy seletivo, o foco é:
- `generate-script`
- `generate-daily-guide`
- `generate-tools-content`

## Resultado esperado

Depois desse hotfix conservador:
- o app volta a ficar previsível
- Daily Guide e Script deixam de falhar silenciosamente
- erros passam a ser claros e rastreáveis
- consumo diário não fica inconsistente
- a correção fica limitada às áreas quebradas, sem arriscar o restante do produto
