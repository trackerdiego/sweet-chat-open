
## Diagnóstico: por que a barra "se mexe" no mobile

Analisei `src/components/Navigation.tsx` + `src/index.css`. Achei **4 causas somadas** — todas conhecidas em relatos de usuários iOS/Android:

1. **`motion.nav` com `initial={{ y: 20, opacity: 0 }}`** — toda vez que a `Navigation` remonta (troca de rota que desmonta layout, StrictMode dev, guard de auth), a barra faz um "salto" de 20px de baixo pra cima. Como ela aparece em quase toda tela, o usuário vê a barra "pulando" ao trocar de aba.

2. **`pb-[env(safe-area-inset-bottom)]` sem `bottom:0` explícito + iOS Safari URL bar colapsando** — no iOS, quando o usuário rola pra baixo o Safari esconde a barra de endereço e o `env(safe-area-inset-bottom)` **muda de valor em tempo real**. Isso reflowa a altura da nav e ela pula alguns pixels pra cima/baixo durante o scroll.

3. **Sem `scrollbar-gutter: stable` no `html`** — quando uma rota tem conteúdo curto (sem scroll) e outra tem conteúdo longo (com scrollbar), o `position: fixed` da nav é reposicionado em relação ao viewport que muda de largura. No desktop e em alguns Androids com scrollbar visível a barra "desloca horizontalmente" ao trocar de rota.

4. **Teclado virtual empurrando a barra** — quando um input recebe foco (ex.: chat, checkout), o `visualViewport` do iOS/Android sobe e a nav `fixed bottom-0` fica ancorada no viewport de layout, aparecendo *sobre* o teclado ou pulando. Isso é o que muitos usuários reportam como "a barra sobe sozinha".

Além disso, o print mostra a barra **estourando pra fora da tela à direita** (o badge "20" e o ícone Config cortados). Isso é o 5º sintoma: com 6 itens (`Painel, Matriz, Script, Tools, Tarefas, Config`) + `flex-1` + `gap` + `px-1`, em telas ~360px o conteúdo total excede a largura e o `overflow-hidden` só esconde — não centraliza.

## Plano de correção

Uma edição em `src/components/Navigation.tsx` e uma em `src/index.css`. Sem mexer em lógica de negócio.

### 1. `src/components/Navigation.tsx`
- **Remover a animação de entrada da nav no mobile** (mantém no desktop se quiser, mas o mais seguro é remover em ambos): trocar `<motion.nav initial={{y:20,opacity:0}} animate={{y:0,opacity:1}}>` por `<nav>` puro. A nav é UI persistente, animação de entrada em elemento persistente = jitter em cada remount.
- **Fixar posicionamento estável no mobile**:
  - Adicionar `style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}` em vez de classe Tailwind arbitrária — evita recomputar quando o Safari colapsa a URL bar.
  - Adicionar `bottom-0` explícito (já está em `fixed bottom-0`) + `translateZ(0)` via `transform-gpu` pra criar layer de composição — trava a barra sem reflow.
- **Esconder ao abrir teclado** (opcional mas resolve o relato "barra sobe"): usar `window.visualViewport` pra detectar `resize` — quando `visualViewport.height < window.innerHeight - 150`, adicionar classe `hidden` ou `translate-y-full`. Faço isso num pequeno hook `useKeyboardOpen()`.
- **Corrigir overflow horizontal em telas estreitas**: trocar `gap-0.5` + `px-1` por `gap-0` + `px-0.5` no mobile, e reduzir texto pra `text-[10px]` quando 6+ itens. Trocar `justify-between` por `justify-around` — distribui melhor sem estourar.
- **Reduzir tamanho do ícone Config no mobile** de `size={20}` pra `size={18}` só quando há badge (ganha espaço).

### 2. `src/index.css`
Adicionar no bloco `html, body`:
```css
html {
  scrollbar-gutter: stable;
}
body {
  overscroll-behavior-y: none; /* remove bounce iOS que arrasta a nav */
}
```
E criar utilitário `.safe-bottom` pra outros lugares reusarem o mesmo cálculo.

### 3. Novo hook `src/hooks/useKeyboardOpen.ts`
Detecta teclado virtual via `visualViewport`. Retorna `boolean`. Usado só na `Navigation` pra aplicar `translate-y-full` quando teclado abre — assim a barra some em vez de flutuar sobre o input.

## Detalhes técnicos

```text
Causa                         → Correção
─────────────────────────────────────────────────────────
motion.nav initial y:20       → <nav> sem animação
env() dinâmico iOS URL bar    → padding via style inline max()
scrollbar shift entre rotas   → scrollbar-gutter: stable
teclado empurra fixed         → useKeyboardOpen() + translate-y-full
overflow em ~360px            → gap/padding menor + text menor
bounce iOS puxa nav junto     → overscroll-behavior-y: none
```

Escopo: só frontend/presentation. Nada de backend, RLS, edge functions. Não toca no fluxo de push (esse fica pro próximo passo assim que essa correção estiver validada).

## Validação
Depois de aplicar, testo com Playwright em viewport 375×812 (iPhone) e 360×740 (Android) — screenshot da nav em 3 rotas (`/`, `/matriz`, `/tarefas`) confirmando que os 6 itens cabem, e simulo foco em input pra ver a nav sumir.
