

# Corrigir Safe Area no iPhone 16 (Dynamic Island)

## Problema

No iPhone 16 e outros modelos com Dynamic Island/notch, o conteúdo das páginas fica atrás da barra de status porque o `pt-6` fixo não considera o `safe-area-inset-top`. A Navigation no desktop usa `md:pt-[env(safe-area-inset-top)]` mas as páginas em si não adicionam padding para o safe area no mobile.

A Landing page já faz certo (`pt-[env(safe-area-inset-top)]` na nav fixa). As páginas internas não.

## Solução

Usar `pt-[max(1.5rem,env(safe-area-inset-top))]` no lugar de `pt-6` nos headers de todas as páginas internas. Isso garante no mínimo 1.5rem (equivalente ao pt-6 atual) mas respeita o safe area quando é maior.

### Arquivos a alterar

1. **`src/pages/Index.tsx`** — Trocar `pt-6` por `pt-[max(1.5rem,env(safe-area-inset-top))]` nos gradient-headers (loading e normal)
2. **`src/pages/Matrix.tsx`** — Mesmo ajuste nos gradient-headers
3. **`src/pages/Tasks.tsx`** — Mesmo ajuste nos gradient-headers
4. **`src/pages/Script.tsx`** — Trocar `pt-6` por `pt-[max(1.5rem,env(safe-area-inset-top))]` no container
5. **`src/pages/Tools.tsx`** — Mesmo ajuste no container
6. **`src/components/Navigation.tsx`** — A nav inferior no mobile já tem `pb-[env(safe-area-inset-bottom)]`, está OK

São alterações simples de CSS em 5 arquivos — trocar `pt-6` pelo valor que respeita o safe area.

