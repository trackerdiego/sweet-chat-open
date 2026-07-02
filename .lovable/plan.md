## Diagnóstico

O erro `Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node` é **a assinatura clássica do Google Translate (Chrome Android) mexendo no DOM que o React controla**. O Chrome no Android traduz páginas em pt-BR "automaticamente" em alguns aparelhos/locales, substitui text nodes por spans, e quando o React tenta re-renderizar (ex.: `AnimatePresence` trocando skeleton→conteúdo na aba Tarefas, ou o polling do `useDailyGuideCache` trocando estado), o reconciler não acha mais o nó anterior → crash → ErrorBoundary mostra "Algo deu errado em Tarefas".

Não é bug do código dela, não é memória, não é rede. É o navegador dela traduzindo. A aba Tarefas é a mais afetada porque tem mais transições condicionais (skeleton, AnimatePresence, cache que hidrata em 2 passos).

## Correção

Bloquear tradução automática no app inteiro + endurecer os pontos com mais churn de DOM.

### 1. `index.html`
- Adicionar `<meta name="google" content="notranslate" />` no `<head>`.
- Adicionar `translate="no"` e `class="notranslate"` no `<html>` (ou `<body>`).

### 2. `src/App.tsx` (ou root layout)
- Adicionar `translate="no"` no wrapper root como reforço (alguns Android ignoram o meta se o `<html>` foi hidratado depois).

### 3. `src/pages/Tasks.tsx`
- Envolver o bloco condicional `loading ? skeleton : conteúdo` com uma `key` estável e garantir que não há text node solto irmão de elemento (padrão que quebra com Translate).
- Marcar o container do `DailyGuide` e `DailySchedule` como `translate="no"` (o conteúdo é gerado por IA em pt-BR mesmo — não perde nada e blinda contra o bug).

### 4. `ErrorBoundary`
- No `componentDidCatch`, se a mensagem bater com `/insertBefore|removeChild|not a child of this node/i`, **auto-reset uma vez** (com flag pra não loopar). Assim, mesmo se a tradução escapar em outro lugar, o app se recupera sozinho sem a usuária ver a tela de erro.

### 5. Mensagem pra usuária
Pedir pra ela, no Chrome Android: menu ⋮ → Traduzir → **"Nunca traduzir vyrallab.online"**. Isso é o fix definitivo do lado dela; nossos passos 1–4 blindam pelo nosso lado.

## Nada de backend

Sem edge functions, sem SQL, sem deploy VPS. Só frontend → Vercel auto-deploy pelo push na `main`.

## Como validar

- Publicar, pedir pra ela abrir de novo em Tarefas.
- Se ainda cair, o auto-reset do ErrorBoundary (passo 4) faz a tela se recuperar em ~1 frame.
