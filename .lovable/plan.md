## Problema

No mobile (391px), o `FloatingNav` renderiza **3 pílulas lado a lado** (logo + nav central + ações "Entrar/Começar"). A pílula de ações é larga demais e o conjunto estoura a viewport — por isso o "Começar →" aparece cortado na direita no print.

Hoje o nav usa `flex items-center justify-between gap-3` sem nenhum tratamento responsivo para encolher botões abaixo de `lg`. A logo atual (`influlab-logo-horizontal.png`) é **180×36 px** e é renderizada com `h-6` (24px de altura visual).

## Correção (responsiva, em todos os dispositivos)

Refactor do `src/components/landing/FloatingNav.tsx` com **dois layouts**:

**Mobile / tablet (< lg, até 1023px):**
- Mostrar apenas **2 pílulas**: logo à esquerda + ações à direita
- Botão "Entrar" vira link de texto (sem fundo de pílula) ou desaparece em < 380px (fica só "Começar")
- Botão "Começar" sem texto longo: vira `"Começar"` curto + ícone, com `px-3` e `text-xs sm:text-sm`
- Logo um pouco menor (`h-5 sm:h-6`) para sobrar respiro
- Adicionar `min-w-0` nos containers e `whitespace-nowrap` nos botões para nunca quebrar
- Reduzir `gap-3` para `gap-2` e `px-3` do `<nav>` para `px-2` em mobile
- Garantir que a soma das pílulas + gaps ≤ viewport (cabendo em 360px de largura)

**Desktop (lg+):**
- Mantém layout atual (3 pílulas com nav central)

**Defesa contra overflow global:**
- Adicionar `max-w-full overflow-hidden` no `<nav>` para nunca causar scroll lateral, mesmo que algo escape

## Tamanho exato da nova logo (para você enviar)

A logo aparece **só** dentro da pílula horizontal do nav, com altura CSS de **24px** (`h-6`). Para nitidez em telas Retina (até 3x DPR de iPhone Pro), o ideal é:

- **Logo horizontal (uso no FloatingNav):**
  - **Altura: 72px** (3× a altura renderizada de 24px)
  - **Largura: proporcional** — mantenha a proporção natural do desenho (a atual é 5:1 → ~360×72px funcionaria, mas envie na proporção que ficar bonita; o CSS usa `w-auto`)
  - **Formato: PNG com fundo transparente** (o nav é escuro; vou remover o `brightness-0 invert` atual se a logo já vier branca/clara — me diga se ela já é branca ou se quer que eu mantenha o filtro de inversão)
  - Peso ideal: < 30 KB

- **Logo quadrada (opcional, usado em outros pontos como favicon/install card):**
  - **512×512 px**, PNG transparente

### Resumo bem curto pro arquivo
- `influlab-logo-horizontal.png` → **~360×72 px**, PNG transparente, logo já em branco
- `influlab-logo.png` (quadrado) → **512×512 px**, PNG transparente

## Arquivo afetado

- `src/components/landing/FloatingNav.tsx` — reestrutura responsiva
- Nenhuma mudança em `index.css` ou tailwind config necessária

## Validação pós-implementação

- 320px, 360px, 375px, 391px (atual), 414px, 768px, 1024px, 1280px — confirmar zero overflow horizontal e nada cortado
- Logo nítida nas 3 resoluções DPR (1x/2x/3x) quando você enviar a nova
