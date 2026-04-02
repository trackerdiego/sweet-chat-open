

# Dose de Coragem — Mudar a Frase Diariamente

## Problema

O componente `MindsetPulse` usa `state.currentDay` (vindo de `user_progress.current_day` no banco) para selecionar a frase. Esse valor só muda quando o usuário avança de dia no programa, não com o calendário real. Então a frase fica estática.

## Solução

Trocar a lógica de seleção da frase para usar a **data real do calendário** em vez do dia do programa. Assim, mesmo que o usuário fique no dia 1 do programa por vários dias, a frase muda todo dia.

## Alteração

**`src/components/MindsetPulse.tsx`**
- Em vez de `mindsetQuotes[(day - 1) % mindsetQuotes.length]`, calcular o índice baseado no dia do ano (`new Date().getDate()` ou day-of-year)
- Isso garante uma frase diferente a cada dia do calendário, independente do progresso no programa

Lógica:
```typescript
const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
const quote = mindsetQuotes[(dayOfYear - 1) % mindsetQuotes.length];
```

Apenas 1 arquivo alterado, alteração de 2 linhas.

