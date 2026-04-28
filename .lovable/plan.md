## Problema

Na navbar inferior mobile (`src/components/Navigation.tsx`), em telas portrait estreitas (≤414px), o item "Config" (engrenagem) é cortado/empurrado para fora. Só aparece em landscape porque há largura suficiente.

## Causa

Cada item usa `px-4` (16px laterais) + `gap` implícito do `justify-around`. Com 5 itens fixos + Config (+ Admin quando logado como admin) o conteúdo excede a largura do viewport mobile, e como não há `overflow` controlado nem padding responsivo, o último elemento é cortado.

## Solução

Em `src/components/Navigation.tsx`, ajustar o container e os itens para garantir que TODOS caibam em qualquer largura mobile:

1. **Container interno** (linha 110): trocar `max-w-lg mx-auto` por `w-full` e adicionar `gap-1` para distribuição uniforme. Manter `justify-around` ou trocar por `justify-between`.

2. **Padding dos itens** (linhas 116, 131, 143): trocar `px-4 py-2` por `px-2 py-2 sm:px-4` — padding lateral menor no mobile, normal a partir de `sm:`. Adicionar `flex-1 min-w-0` para que cada item ocupe fração igual e nunca estoure.

3. **Label** (`<span>Config</span>` etc): adicionar `truncate` no span para evitar overflow caso algum label seja longo.

4. **Wrapper `<motion.nav>`**: adicionar `overflow-hidden` como salvaguarda.

Resultado: 5 itens (ou 6 com admin) cabem confortavelmente em qualquer largura mobile (≥320px), preservando o layout md: atual no desktop.

## Arquivo afetado

- `src/components/Navigation.tsx` — alterações apenas de classes Tailwind, sem mudança de lógica.

## Deploy

Frontend-only (Vercel auto-deploy do GitHub). Sem comandos VPS.
