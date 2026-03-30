

# Exemplos de Tarefas: 5 por tipo + Personalizados com Analise Visceral

## Problema Atual

- Os exemplos estaticos em `dailySchedule.ts` tem apenas 1-3 por tarefa (alguns so 1)
- Sao genericos, nao usam o perfil de audiencia visceral do onboarding
- O conteudo AI (`generate-daily-guide`) gera hooks, storytelling, etc. mas NAO gera exemplos para as tarefas do checklist

## Plano

### 1. Expandir exemplos estaticos para 5 cada (fallback)

**Arquivo:** `src/data/dailySchedule.ts`

Completar o objeto `taskExamples` para que cada nicho tenha exatamente 5 exemplos por tarefa (morningInsight, morningPoll, reel, reelEngagement, valueStories, lifestyleStory, feedPost). Isso garante fallback antes do usuario gerar IA.

### 2. Gerar exemplos de tarefa via IA com perfil visceral

**Arquivo:** `supabase/functions/generate-daily-guide/index.ts`

Adicionar uma nova categoria `taskExamples` ao prompt e ao function tool da IA:
- Estrutura: objeto com chaves por tarefa, cada uma com array de 5 strings
- O prompt ja recebe o perfil visceral completo — basta instruir a IA a gerar exemplos praticos para cada slot de tarefa usando os gatilhos psicologicos do publico

### 3. Passar exemplos AI para o DailySchedule

**Arquivo:** `src/components/DailyGuide.tsx`
- Expandir `AiGuideContent` para incluir `taskExamples?: Record<string, string[]>`

**Arquivo:** `src/components/DailySchedule.tsx`
- Receber `aiContent.taskExamples` e, quando disponivel, usar no lugar dos exemplos estaticos de cada `TaskItem`

**Arquivo:** `src/pages/Tasks.tsx`
- Ja passa `aiContent` para `DailySchedule` — nenhuma mudanca necessaria

### Fluxo resultante

```text
Onboarding → audience_profiles (perfil visceral)
                    ↓
generate-daily-guide (le perfil visceral)
                    ↓
Retorna: hooks, storytelling, ctas, cliffhangers + taskExamples
                    ↓
DailySchedule exibe 5 exemplos personalizados por tarefa
```

### Arquivos alterados

1. `src/data/dailySchedule.ts` — expandir exemplos estaticos para 5 cada
2. `supabase/functions/generate-daily-guide/index.ts` — adicionar taskExamples ao prompt/tool
3. `src/components/DailyGuide.tsx` — expandir tipo AiGuideContent
4. `src/components/DailySchedule.tsx` — usar taskExamples do AI quando disponivel

