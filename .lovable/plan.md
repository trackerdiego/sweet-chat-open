

# Correção: Tela branca nas páginas Script e Tarefas

## Problema

As páginas **Index** e **Matrix** funcionam porque checam o estado de loading das strategies e mostram um skeleton enquanto carrega. Já as páginas **Script** e **Tasks** não fazem essa checagem — renderizam imediatamente com `strategies` vazio (`[]`), o que faz `todayStrategy` ser `undefined`. Isso causa crash silencioso nos componentes filhos (`ScriptGenerator`, `DailyGuide`, etc.) que esperam receber um objeto válido.

A página **Tools** provavelmente também trava se `useUserUsage` ainda não carregou.

## Solução

Adicionar guards de loading em 3 páginas:

### 1. `src/pages/Script.tsx`
- Importar `Skeleton` 
- Checar `strategies.length === 0` (ou loading do hook)
- Mostrar skeleton/loading enquanto strategies não carregam
- Só renderizar `ScriptGenerator` quando `todayStrategy` existir

### 2. `src/pages/Tasks.tsx`
- Já tem acesso a `useUserStrategies` mas não checa loading
- Adicionar guard similar: se `strategies.length === 0`, mostrar skeleton
- Proteger renderização de `DailyGuide` e `DailySchedule`

### 3. `src/pages/Tools.tsx`
- Checar `loading` do `useUserUsage`
- Mostrar skeleton enquanto carrega

## Padrão a seguir

Mesmo padrão já usado em Index.tsx e Matrix.tsx — skeleton com layout similar ao conteúdo final para evitar layout shift.

