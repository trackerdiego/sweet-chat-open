# Fix: Aba Tarefas — destrava após dia 30 e respeita matriz do usuário

## Problemas identificados

### 1. Trava no dia 30/30
Em `src/hooks/useUserProgress.ts` (linha 26):
```ts
return Math.max(1, Math.min(30, diffDays + 1));
```
O `Math.min(30, ...)` clampa o `current_day` em 30 pra sempre. A partir do 31º dia o usuário fica congelado em "Dia 30 de 30" e o mesmo conteúdo se repete indefinidamente.

### 2. Tema da semana descolado do nicho
Em `src/data/dailySchedule.ts` (linha 9 e 570):
```ts
weeklyThemes[dayOfWeek] // sexta = "Estética & Luxo", sábado = "Família & Lazer"...
```
São temas **fixos por dia da semana do calendário**, totalmente independentes da matriz personalizada. Por isso uma sexta-feira mostra "Estética & Luxo" mesmo o nicho do usuário sendo "digital". O card também não reflete o tópico real do dia da matriz (ex.: `strategy.pillarLabel` + `strategy.title`).

### 3. Visão semanal recorta por bloco fixo
`WeeklyView.tsx` usa `weekStart = floor((currentDay-1)/7)*7+1`, sempre dias 1-7, 8-14, ..., independente de qual dia da matriz o usuário está hoje. Combinado com #1, depois do dia 30 também trava na última fatia (29-30 + lixo).

---

## Solução

### A. Ciclar a matriz a cada 30 dias (não travar mais)

`useUserProgress.ts` — `calcRealDay` passa a retornar o **dia absoluto** sem clamp:
```ts
return Math.max(1, diffDays + 1); // pode crescer além de 30
```

`useInfluencer.ts` — deriva o dia da matriz a partir do absoluto:
```ts
const absoluteDay = progress.current_day;
const matrixDay = ((absoluteDay - 1) % 30) + 1; // 1..30 cíclico
const cycle = Math.floor((absoluteDay - 1) / 30) + 1; // 1, 2, 3...
```
- `strategies[matrixDay - 1]` indexa a matriz.
- `tasks_completed` continua chaveado pelo `absoluteDay` (não pelo matrixDay), então quando entra no ciclo 2 o checklist do novo dia "1 do ciclo 2" começa zerado — não herda os checks do dia 1 original.
- `completedDays` continua funcionando com a chave absoluta.

Expor no retorno do hook: `matrixDay`, `cycle`, além do `currentDay` (absoluto).

### B. Header e UI refletem o ciclo

`Tasks.tsx`:
- Subtítulo passa a ser `Dia {matrixDay} de 30` quando `cycle === 1`, e `Dia {matrixDay} · Ciclo {cycle}` a partir do ciclo 2.

`DailySchedule.tsx`:
- Usa `matrixDay` (não `currentDay`) ao montar prompts de `task_examples` e ao gerar exemplos rotacionados em `pickExamplesForDay`. Isso garante que dois dias seguidos do mesmo ciclo nunca caiam no mesmo conjunto de exemplos.

`useDailyGuideCache` em `Tasks.tsx`: passa `matrixDay` no campo `day` pra cache do guia ficar coerente com o dia da matriz, e adicionalmente inclui `cycle` no payload (cacheia separadamente por ciclo).

### C. Tema do dia = pilar real da matriz (não o dia da semana)

`src/data/dailySchedule.ts` — em `getDailySchedule`, substituir:
```ts
const theme = weeklyThemes[dayOfWeek];
```
por um tema **derivado da própria entrada da matriz**:
```ts
const theme: WeeklyTheme = {
  name: strategy.pillarLabel,        // ex.: "Digital — Autoridade"
  emoji: getPillarEmoji(strategy.pillar),
  objective: strategy.title,         // título exato do dia X da matriz
};
```
- `dayOfWeekName` (Sexta, Sábado…) **continua sendo o nome real do dia da semana civil** — usuário enxerga "Sexta — Digital — Autoridade" em vez de "Sexta — Estética & Luxo".
- `isFeedDay` deixa de depender de `dayOfWeek` fixo e passa a usar `strategy.isFeedDay` se existir, com fallback pra `[1,3,5]` do `dayOfWeek` (mantém compat).
- `weeklyThemes` (objeto hardcoded) pode permanecer no arquivo como fallback, mas não é mais a fonte primária.

### D. Visão semanal segue o ciclo atual

`WeeklyView.tsx`:
- Recebe `currentDay` que agora é o `matrixDay` (1..30) — semantically clean para a fatia da semana.
- `weekStart = floor((matrixDay - 1) / 7) * 7 + 1` continua válido e nunca passa de 30.
- Pinta como "hoje" o card onde `day.day === matrixDay`.
- Em `Tasks.tsx` e demais consumidores (`Index.tsx`, `Script.tsx`, `Matrix.tsx`) onde hoje passam `state.currentDay` pro `WeeklyView`/strategy lookup, passar `matrixDay`.

### E. Gating freemium

`useUserUsage.canAccessDay(day)` — chamar com `matrixDay` em vez do absoluto. Assim o usuário não-premium que estaria no dia 31 absoluto recai no dia 1 do ciclo 2 e o gate não dispara incorretamente.

---

## Arquivos modificados

- `src/hooks/useUserProgress.ts` — remover clamp `Math.min(30, ...)`.
- `src/hooks/useInfluencer.ts` — derivar `matrixDay`/`cycle`, indexar `strategies` por `matrixDay`, expor ambos no retorno, manter `tasks_completed` chaveado pelo absoluto.
- `src/data/dailySchedule.ts` — `getDailySchedule` monta `weeklyTheme` a partir de `strategy` (pillarLabel/title/pillar emoji) e usa `isFeedDay` da própria estratégia quando disponível.
- `src/pages/Tasks.tsx` — usar `matrixDay` para `todayStrategy`, cache do guia, gating; header mostra "Dia X de 30" ou "Dia X · Ciclo Y".
- `src/components/DailySchedule.tsx` — usar `matrixDay` no payload do job `task_examples` e em `pickExamplesForDay`.
- `src/components/WeeklyView.tsx` — receber e usar `matrixDay` para a fatia/destaque.
- `src/pages/Index.tsx`, `src/pages/Script.tsx`, `src/pages/Matrix.tsx` — onde leem `state.currentDay` para indexar a matriz ou pintar a visão semanal, trocar por `matrixDay` (sem mexer em lógica de pontos/streak, que ficam no absoluto).

## Não muda

- Backend / edge functions / schema: nenhuma migração.
- `useUserStrategies` continua entregando 30 dias.
- Geração da matriz, prompts da IA, push, paywall: intocados.
- Coins, streak, pontos: continuam baseados no dia absoluto (não regenera coins quando o ciclo dá a volta).
