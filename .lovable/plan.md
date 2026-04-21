

# Plano: estabilizar pipeline de onboarding (sem perder qualidade dos prompts)

## Diagnóstico — por que onboarding falha mas o resto do app funciona

| Function | Chamadas Gemini | Modelo | Tempo típico | Timeout do gateway |
|---|---|---|---|---|
| `generate-script` | 1 | flash | 10-25s | ✅ ok |
| `generate-tools-content` | 1 | flash | 15-30s | ✅ ok |
| `generate-daily-guide` | 2 paralelas | flash | 20-35s | ✅ ok |
| **`generate-audience-profile`** | **2 sequenciais** | **2.5-pro** | **60-180s** | ❌ estoura |
| **`generate-personalized-matrix`** | **4 paralelas** | **2.5-pro** | **60-120s** | ⚠️ borderline |

**Causa raiz**: o estudo visceral (audience-profile) usa `gemini-2.5-pro` em **duas etapas sequenciais** (descrição + avatar), cada uma com `timeoutMs: 120000` no backend. Total: até 240s. Mas:
- O Kong/gateway do Supabase self-hosted tem timeout default de ~60s
- O `supabase.functions.invoke` no browser não streama — aguarda response inteiro
- Resultado: o frontend recebe erro de rede/timeout antes do Gemini terminar, mesmo com a function ainda viva

Os prompts e a qualidade do estudo visceral **não precisam mudar**. O que muda é a arquitetura: separar as 2 etapas do audience-profile em 2 chamadas client→function distintas (cada uma <60s), igual ao padrão que funciona no resto do app.

## O que vai mudar

### 1. Edge function `generate-audience-profile` — dividir em 2 modos

Hoje a function faz step1+step2 numa request só. Vou aceitar um parâmetro `step` ('description' ou 'avatar') e devolver/persistir parcial:

- **`step: 'description'`** → roda só step1 (gemini-2.5-pro, descrição livre). Persiste `audience_description` em `audience_profiles`. Tempo: ~25-50s.
- **`step: 'avatar'`** → lê `audience_description` salva, roda step2 (gemini-2.5-pro com schema). Persiste `avatar_profile`. Tempo: ~30-60s.

Cada chamada cabe no timeout do gateway. Os prompts continuam **idênticos** (mesmo system, mesmo schema visceral de 30+ campos, mesmo modelo). Só muda o transporte.

Fallback: se `gemini-2.5-pro` der timeout no `tryModel`, o helper `callGeminiNative` já cai pra `gemini-2.5-flash` automaticamente — só preciso reduzir `timeoutMs` interno de 120s pra 55s pra forçar o fallback antes do gateway cortar.

### 2. Edge function `generate-personalized-matrix` — proteção idêntica ao Stack Overflow pattern

Hoje retorna 500/502 cru quando Gemini falha. Vou:
- Reduzir `timeoutMs` interno de 90s → 55s por semana (4 chamadas paralelas continuam paralelas, mas com fallback rápido)
- Garantir que erros retornem `{ error, retryable: true }` com status 200 quando forem falhas transitórias do Gemini, pra o cliente saber distinguir "tente de novo" de "deu ruim de verdade"

Prompts e schema **não mudam**.

### 3. Onboarding (`src/pages/Onboarding.tsx`) — chamar 3 etapas separadas

Substituir a chamada única `generate-audience-profile` por **2 chamadas sequenciais**:

```text
handleFinish flow:
1. Salva profile (já existe)
2. Pipeline UI:
   ├─ Step "audience" ACTIVE
   │  └─ invoke('generate-audience-profile', { step: 'description' })
   │     └─ on success → audience DONE
   ├─ Step "visceral" ACTIVE
   │  └─ invoke('generate-audience-profile', { step: 'avatar' })
   │     └─ on success → visceral DONE
   ├─ Step "matrix" ACTIVE
   │  └─ invoke('generate-personalized-matrix') (já existe)
   │     ├─ on success → matrix DONE → finalize
   │     └─ on error → mostra retry/skip (já existe)
   └─ Step "finalize" → updateProfile({ onboarding_completed: true })
```

Vantagens:
- Cada chamada <60s ⇒ não estoura gateway
- Barra de progresso reflete realidade (cada etapa termina com sucesso real)
- Se "visceral" (step 2) falhar, "audience" (step 1) já está salva no banco — retry só refaz o avatar, não a descrição inteira
- Mantém UX atual com os 4 cards ("Analisando", "Estudo visceral", "Matriz", "Finalizando")

### 4. Retry granular no frontend

Adicionar handler de retry específico pra cada etapa (hoje só matrix tem retry). Se "Estudo visceral" falhar, botão "Tentar novamente" refaz só o step `avatar` — barato e rápido.

## Arquivos tocados

- `supabase/functions/generate-audience-profile/index.ts` — aceitar `step` param, dividir lógica, reduzir timeout interno
- `supabase/functions/generate-personalized-matrix/index.ts` — reduzir timeout interno por semana, padronizar erro retryable
- `src/pages/Onboarding.tsx` — orquestrar 3 invocações separadas + retry granular por etapa
- **Nada muda em**: prompts, schemas viscerais, modelos Gemini, `_shared/gemini.ts`, fluxo de finalização, UI dos 4 cards

## O que NÃO faço

- Não mudo nenhum prompt (refinados, mantidos)
- Não troco modelo (continua gemini-2.5-pro pro estudo visceral)
- Não removo o schema de 30+ campos
- Não toco em `_shared/gemini.ts` (helper já tem retry/fallback robustos)
- Não mexo em outras edge functions que já funcionam
- Não aplico migrations — schema do `audience_profiles` já comporta upsert parcial (`audience_description` separado de `avatar_profile`)

## Resultado esperado

Onboarding completo em ~90-150s (3 chamadas curtas em vez de 1 longa que o gateway mata aos 60s). Sem mais erro vermelho no "Estudo visceral", e quando algo realmente falhar, o retry só refaz a etapa que quebrou em vez do pipeline inteiro.

