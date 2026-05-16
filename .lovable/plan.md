# Diversificar sugestões dos blocos de horário (manhã / tarde / noite)

## Problema

1. As sugestões dentro de cada horário (`taskExamples` em `src/data/dailySchedule.ts`) são **5 exemplos fixos por pilar/tarefa**. Não importa se é Dia 1 ou Dia 25 — o usuário vê os mesmos 5 itens em "Story matinal", "Reels", "Stories de valor" etc.
2. O único jeito de diversificar hoje é clicar em **"✨ Gerar com IA"** dentro do *Guia do Dia* (`DailyGuide`), que regenera **tudo** (hooks, storytelling, CTAs, cliffhangers, contentTypes, videoFormats **+** taskExamples) e gasta cota de geração só pra atualizar as sugestões dos horários.

## Solução em 2 frentes

### 1. Variação automática dia a dia (sem IA, sem custo)

Expandir cada array de `taskExamples` em `src/data/dailySchedule.ts` de **5 → 12 exemplos** por tarefa e por pilar (beleza, fitness, vida-real, negocios, principal, lifestyle).

Criar um helper `pickExamplesForDay(all: string[], day: number, taskKey: string): string[]` que retorna uma janela rotativa de 5 itens baseada no dia + chave da tarefa (hash determinístico pequeno). Resultado: cada dia o usuário vê uma combinação diferente; só haveria repetição perceptível depois de ~12 dias, e ainda assim com ordem distinta entre tarefas.

Aplicar o helper em `DailySchedule.tsx` (linha onde `examples = aiExamples ?? task.examples`) — mantendo a precedência: se vier da IA, IA ganha; senão, usa janela rotativa do dia.

### 2. Botão de IA exclusivo das sugestões dos blocos

Adicionar um botão "✨ Diversificar sugestões com IA" no cabeçalho do `DailySchedule` (ao lado do `Progress`/dia da semana). Ele faz **apenas** a chamada B do daily-guide (taskExamples), sem regenerar hooks/CTAs/storytelling.

**Backend** — nova edge function par:
- `supabase/functions/start-task-examples-job/index.ts` — segue o padrão obrigatório `ai_jobs` + `enqueueJob` + `runInBackground` (mem `features/ai-jobs-pattern`). Reaproveita o `promptB` + `schemaB` do `start-daily-guide-job`. Usa modelos `gemini-2.5-flash → flash-lite → pro`.
- Reutiliza `get-ai-job-status` (sem mudança).
- Conta como **1 geração de tool** em `user_usage.tool_generations` (mesmo limite de 2/dia free, ilimitado premium) — ou, se preferir, NÃO conta porque é mais barato. **Decisão a confirmar com o usuário** (ver pergunta abaixo).

**Migration SQL manual no Studio self-hosted** (Lovable migrations não chegam lá — mem `infra/backend-selfhosted`):
```sql
ALTER TABLE public.ai_jobs DROP CONSTRAINT IF EXISTS ai_jobs_job_type_check;
ALTER TABLE public.ai_jobs ADD CONSTRAINT ai_jobs_job_type_check
  CHECK (job_type IN ('tools','script','daily_guide','transcription','task_examples'));
```

**Frontend**:
- `src/components/DailySchedule.tsx` recebe nova prop `onAiTaskExamples?: (examples) => void` e renderiza o botão. Usa o hook genérico `useAiJob<{ taskExamples: Record<string,string[]> }>('task_examples')` (precisa adicionar `'task_examples'` em `AiJobType` e `FUNCTION_BY_TYPE` em `src/hooks/useAiJob.ts`).
- `src/pages/Tasks.tsx` faz o merge: quando o botão do bloco gera, atualiza só a chave `taskExamples` do `aiContent`; quando o `DailyGuide` gera, atualiza tudo. Pequeno `mergeAiContent` helper.

## Diagrama do fluxo

```text
Tasks.tsx
 ├── DailyGuide (botão "Gerar guia com IA")
 │     └── start-daily-guide-job   → hooks/CTAs/storytelling + taskExamples
 │
 └── DailySchedule (botão "Diversificar sugestões com IA")  ← NOVO
       └── start-task-examples-job → SÓ taskExamples
              (mesmo padrão ai_jobs + waitUntil + polling)

Sem clicar em IA:
  examples = pickExamplesForDay(staticExamples[12 itens], day, taskKey)
  → rotação visível dia a dia, sem custo
```

## Arquivos afetados

- `src/data/dailySchedule.ts` — expandir `taskExamples` para 12 itens por chave em cada pilar; exportar `pickExamplesForDay`.
- `src/components/DailySchedule.tsx` — usar helper, adicionar botão e estado de loading; nova prop opcional.
- `src/pages/Tasks.tsx` — merge de `aiContent` parcial.
- `src/hooks/useAiJob.ts` — adicionar `'task_examples'` no tipo + map.
- `supabase/functions/start-task-examples-job/index.ts` — **novo**.
- SQL manual no Studio self-hosted (CHECK constraint).

## Pergunta antes de implementar

O botão novo "Diversificar sugestões com IA" deve **consumir a cota diária de gerações** (igual o Guia do Dia) ou ser **gratuito/separado** (rate-limited só por tempo)?
