

# Corrigir input do chat coberto pela barra de navegação no mobile

## Problema

Na página Tools, quando o chat IA está aberto no mobile, a barra de navegação inferior (`Navigation`) fica fixa sobre o input de texto do chat, impossibilitando a digitação.

## Causa raiz

- O container do chat em `Tools.tsx` (linha 281) usa `h-[100dvh]` mas não reserva espaço para a barra de navegação inferior (que tem ~60px + safe-area).
- O `AiChat.tsx` ocupa `h-full` do container pai, mas o input na parte inferior fica escondido atrás da nav.

## Solução

### 1. `src/pages/Tools.tsx`

Adicionar `pb-20` (padding-bottom) ao container do chat no mobile para empurrar o conteúdo acima da barra de navegação. Alterar a classe do container quando `selectedTool?.id === 'chat'` de:

```
h-[100dvh] flex flex-col md:pt-20 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]
```

Para:

```
h-[100dvh] flex flex-col md:pt-20 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-20 md:pb-0
```

Isso garante que no mobile o input fique acima da barra, e no desktop (onde a nav é no topo) não adiciona padding extra.

### Arquivos impactados
- `src/pages/Tools.tsx` — adicionar `pb-20 md:pb-0` ao container do chat

