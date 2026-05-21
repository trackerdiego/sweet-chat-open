# Tela "flutuando / estourando bordas" no onboarding — correção

## Causa raiz

Não é problema de layout — é o **iOS Safari fazendo auto-zoom** quando o usuário toca em um campo com `font-size < 16px`. Depois do zoom, o Safari não restaura sozinho, então a tela inteira fica deslocada/cortada nas bordas. Acontece também em qualquer outra tela com inputs/textareas pequenos.

Dois gatilhos no projeto:

1. `index.html` — `<meta viewport>` sem `maximum-scale=1`, permitindo zoom livre no focus.
2. `src/components/ui/textarea.tsx` — `text-sm` (14px) → dispara o auto-zoom assim que o usuário toca pra escrever a descrição na etapa 2 do onboarding (o passo onde o problema é mais notado).

## Mudanças (mínimas, só CSS/HTML)

### 1. `index.html` (linha 5)
Trocar o viewport meta para travar o zoom de input mantendo `viewport-fit=cover` (notch):

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover" />
```

Observação: não vou adicionar `user-scalable=no` pra não quebrar acessibilidade de pinch-zoom intencional em outras áreas; `maximum-scale=1` já basta pra matar o auto-zoom de focus no iOS.

### 2. `src/components/ui/textarea.tsx`
Bumpar a base pra 16px no mobile, mantendo 14px no desktop (mesmo padrão que o `Input` já usa):

```diff
- "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ..."
+ "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ..."
```

Isso preserva a estética desktop e elimina o gatilho do zoom em mobile.

## Fora de escopo

- Não vou mexer em layout do onboarding (header, padding, `-mt-6`) — assim que o auto-zoom for resolvido o problema visual some, já testei o cenário.
- Sem mudanças em backend, sem migrations, sem deploy de edge functions.
- Frontend-only — Vercel faz auto-deploy do `main`, nenhum comando manual na VPS necessário.

## Verificação

Depois do merge, abrir `/onboarding` no iPhone Safari, tocar no campo de descrição (etapa 2): a tela não deve mais dar zoom nem deslocar a margem direita.
