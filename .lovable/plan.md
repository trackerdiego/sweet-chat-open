## Objetivo

Trocar o `InstallVideoModal` (Wistia) por um modal **visual com imagem ilustrativa**, no estilo da referência enviada (ZK Delivery): texto curto + ícones inline (compartilhar ↑ / adicionar ➕) mostrando exatamente onde tocar na barra inferior do navegador. Detectar iOS vs Android para mostrar o conjunto certo de símbolos.

## Mudanças

### 1. `src/components/InstallVideoModal.tsx` — reescrever

Remover toda a parte de Wistia (`ensureWistiaScripts`, `<wistia-player>`, scripts injetados). Manter:

- Mesmo nome do componente e export `INSTALL_VIDEO_SEEN_KEY` (para não quebrar `Index.tsx`).
- Mesma chave `localStorage` (`influlab.installVideoSeen`).
- Mesmo trigger (Dialog + `open/onOpenChange`).

Novo conteúdo do modal:

- Detecta plataforma via `navigator.userAgent`: `isIOS`, `isAndroid`, fallback "outro".
- Renderiza **uma seção por plataforma** com o mesmo padrão visual da referência:
  - Texto explicativo curto em 2 frases.
  - Ícones inline grandes (lucide) embutidos no parágrafo, igual ao print: `Share` (iOS) / `MoreVertical` (Android), e `Plus` no segundo passo.
  - Mockup ilustrativo da barra inferior (iOS) ou superior (Android) do navegador — usa um bloco visual com `rounded-full bg-muted` + ícones, sem imagem externa (evita asset novo e mantém leve).

Conteúdo por plataforma:

- **iOS (Safari)**:
  > Adicione o **Vyral Lab** à sua tela inicial para receber notificações e acesso rápido.
  > Toque em **Compartilhar** [icone ↑] e depois em **Adicionar à Tela de Início** [icone ➕].
  - Mockup da barra inferior do Safari (pill cinza com `app.vyrallab.online`).

- **Android (Chrome)**:
  > Adicione o **Vyral Lab** à sua tela inicial.
  > Toque no menu **⋮** no canto superior direito e depois em **Instalar app** / **Adicionar à tela inicial** [icone ➕].
  - Mockup da barra superior do Chrome com ícone `MoreVertical` destacado.

- **Outro / desktop**: cai num fallback simples ("Abra no celular para instalar") — sem botões pesados.

Botões finais (iguais aos atuais):
- "Já instalei" (primary, marca `SEEN_KEY` e fecha).
- "Ver depois" (ghost, só fecha).

### 2. Nenhuma outra mudança

- `src/pages/Index.tsx` continua importando o mesmo componente com a mesma API — zero alteração.
- Nada de novo asset, nada de service worker, nada de backend.

## Detalhes técnicos

- Detecção:
  ```ts
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  ```
- Ícones de `lucide-react`: `Share`, `Plus`, `MoreVertical`, `X` (close já é do Dialog).
- Tokens de cor: usar `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border` — nada hardcoded.
- Largura: manter `max-w-[380px]`, padding `p-5`.
- Acessibilidade: `DialogTitle` e `DialogDescription` mantidos; ícones inline com `aria-hidden`.

## Fora do escopo

- Não mexer em `InAppBrowserBanner` (esse já trata Instagram/Facebook in-app).
- Não mexer em `InstallInstructionsModal` (esse é o modal grande passo-a-passo, usado em outros pontos).
- Não remover o componente nem o `INSTALL_VIDEO_SEEN_KEY` para preservar o gatilho atual.
- Não criar nova edge function / migration.