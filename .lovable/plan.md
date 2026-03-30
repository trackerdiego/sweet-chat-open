

# Sincronizar Projeto com Guia de Referencia

## Analise

Comparei cada secao do guia com o codigo atual. A maioria ja esta implementada corretamente. A unica dissonancia real encontrada:

### Dissonancia: Secao "Cliffhangers" ausente no DailyGuide

O guia especifica que `generate-daily-guide` retorna **6 categorias**, incluindo `cliffhangers`. A Edge Function ja gera essa categoria. Porem, o componente `DailyGuide.tsx` so renderiza **5 secoes** no accordion — o array `sectionAiKeys` nao inclui `cliffhangers`, e `getDailyGuideContent()` em `dailyGuideContent.ts` so retorna 5 secoes.

Resultado: os cliffhangers personalizados pela IA sao gerados mas nunca exibidos.

## Plano

### 1. Adicionar secao Cliffhangers ao conteudo estatico

**Arquivo:** `src/data/dailyGuideContent.ts`

- Adicionar uma 6a secao na funcao `getDailyGuideContent()` com icone `🔥`, titulo `"Cliffhangers"` e 5 frases estaticas de fallback

### 2. Renderizar cliffhangers no accordion do DailyGuide

**Arquivo:** `src/components/DailyGuide.tsx`

- Adicionar `'cliffhangers'` ao array `sectionAiKeys` (de 5 para 6 entradas)
- Atualizar o tipo `SectionAiKey` para incluir `'cliffhangers'`

### Arquivos alterados

1. `src/data/dailyGuideContent.ts` — adicionar secao cliffhangers
2. `src/components/DailyGuide.tsx` — incluir cliffhangers no mapeamento AI

### O que ja esta correto (sem mudancas necessarias)

- Onboarding: 3 etapas, pipeline, prompts, fallback — OK
- `generate-audience-profile`: 2 etapas, schema completo — OK
- `generate-personalized-matrix`: distribuicao visceral, schema DayStrategy — OK
- `generate-script`: validacao server-side, injecao avatar — OK
- `ai-chat`: LOVABLE_API_KEY, streaming, contexto avatar — OK
- `useUserProgress`: calcRealDay, debounce 500ms — OK
- `useInfluencer`: migrateTasks, pontuacao, progresso — OK
- `useUserUsage`: FREE_LIMITS, reset diario scripts — OK
- `useUserStrategies`: fallback, merge — OK
- Interfaces TypeScript: DayStrategy, DailyTaskState, InfluencerProgress — OK

