## Fix definitivo: blindar chamadas ao Gemini contra 503/overloaded

**Causa raiz confirmada:** logs mostram `GeminiError` em 22.3s no job `7bba8fc9...`. A retry policy atual em `_shared/gemini.ts` é frágil pra picos do `generativelanguage.googleapis.com`:
- `primaryAttempts: 1` (desiste na 1ª falha)
- `fallbackAttempts: 2` com delays de 1.5s/3s
- Sem jitter, sem cascata multi-modelo, sem leitura do `Retry-After`

Como o app é self-hosted, não temos o AI Gateway da Lovable que faz retry/balancing automático. Precisamos replicar essa robustez no cliente.

### Mudanças (sem mock, sem paliativo)

#### 1. `supabase/functions/_shared/gemini.ts` — retry industrial

**Cascata de modelos (3 níveis em vez de 2):**
```
gemini-2.5-pro  →  gemini-2.5-flash  →  gemini-2.5-flash-lite
```
Cada nível com seus próprios attempts. Se o `pro` tá congestionado, o `flash` quase nunca tá ao mesmo tempo, e o `flash-lite` é a rede de segurança.

**Defaults novos:**
- `primaryAttempts: 2` (era 1) — picos do `pro` costumam durar <10s
- `mid` (`gemini-2.5-flash`): 2 attempts
- `fallbackAttempts: 3` (era 2) — `flash-lite` raramente falha 3x seguidas
- Delays exponenciais com jitter: `2s ±500ms → 5s ±1s → 10s ±2s` (em vez de 1.5/3/4 fixos)

**Respeitar `Retry-After` do Gemini:**
Quando vier 429/503, ler o header `Retry-After` (segundos) e usar como base do próximo sleep, capado em 15s.

**Detectar erro de modelo overloaded no body:**
Gemini às vezes retorna 200 com `{"error": {"status": "UNAVAILABLE"}}` no envelope. Tratar como retriable.

**Timeout total (deadline) por chamada:**
Hoje cada `tryModel` pode acumular muito tempo. Adicionar `globalDeadlineMs: 90000` (job inteiro tem até 90s). Quando perto do deadline, pula etapas.

**Logs estruturados:**
JSON em uma linha com `{tag, model, attempt, status, latencyMs, retryAfter}` pra facilitar grep depois.

#### 2. Sem mudanças nos `start-*-job` ou no frontend

A blindagem é 100% no shared. Todas as functions que importam `callGeminiNative` herdam o fix automaticamente: `start-script-job`, `start-tools-job`, `start-daily-guide-job`, `start-transcription-job`, `generate-onboarding`, `generate-strategy`, etc.

#### 3. Métrica observável: coluna `attempts` em `ai_jobs`

Quando o worker chamar Gemini, salvar quantas tentativas precisou no `result.attempts` ou em coluna nova. Permite ver depois se 95% dos jobs precisam só 1 tentativa ou se o `pro` tá derrubando tudo.

**SQL pro user rodar no Studio:**
```sql
ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS attempts INT;
ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS model_used TEXT;
```

### Resultado esperado

- Job que hoje falha com Gemini overloaded → automaticamente cai pra `flash` ou `flash-lite` e entrega resposta em 30-60s em vez de erro
- Ainda dentro do orçamento de 90s do worker (que não tem timeout de gateway porque é background)
- Mensagem "instável" só aparece se TODOS os 3 modelos falharem TODAS as tentativas (cenário de outage real do Google, raríssimo)

### O que NÃO vou fazer

- ❌ Não vou mockar resposta
- ❌ Não vou esconder erro do user
- ❌ Não vou trocar Gemini por outro provider sem você pedir
- ❌ Não vou subir attempts pro infinito (custa $ e mascara problemas reais)

### Deploy depois da aprovação

Frontend: nada (mudança só no edge function).
VPS:
```bash
cd /root/app && git pull origin main
./scripts/deploy-selfhost.sh start-script-job start-tools-job start-daily-guide-job start-transcription-job
```
SQL no Studio self-hosted (opcional mas recomendo pra observabilidade):
```sql
ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS attempts INT;
ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS model_used TEXT;
```
