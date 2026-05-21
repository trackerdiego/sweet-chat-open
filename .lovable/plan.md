# Redesign do Painel — inspirado nos mockups enviados

## Leitura das referências
As 4 imagens compartilham o mesmo DNA:
- **Saudação grande no topo** ("Hello, Wilson" / "Hi, Sakib 👋 How may I help you today?") — pessoal, tipografia forte.
- **Hero card de destaque** (Premium Plan com mascote, ou "Talk with Bot" roxo) — 1 card grande que domina visualmente.
- **Grid 2×2 de "Quick Access"** com ícone + título + seta no canto — entradas rápidas para as funções principais.
- **Lista "History / Recent"** com ícone circular + título + timestamp — densidade baixa, respiro.
- **Estética**: roxo neon escuro, cantos arredondados generosos (2xl/3xl), glows sutis nos cards, mascote 3D como elemento de marca, muito espaço em branco vertical.

## O que está estranho hoje
O painel atual virou uma pilha vertical: saudação → 3 chips → banner free → card do dia → bloco enorme de Hype com 15 cards iguais. Não tem hierarquia, nem ponto focal, nem entradas rápidas para outras áreas do app (Matrix, Tasks, Tools, Chat, Carteira). O Hype tomou conta de tudo.

## Nova estrutura proposta (mobile-first, ~390px)

```text
┌──────────────────────────────────┐
│ logo                ☾  ?  ⎋      │
│                                  │
│ Hi, Diego 👋                     │
│ Como vamos viralizar hoje?       │
│                                  │
│ ┌────────────────────────────┐   │ ← HERO CARD (estratégia do dia)
│ │  Dia 30/30 · Autoridade    │   │   gradient roxo→pink, glow neon
│ │  [Título da estratégia]    │   │   borda neon, mascote/ícone à dir
│ │  [hook curto]              │   │   CTA "Abrir roteiro →"
│ │                       🎯   │   │
│ └────────────────────────────┘   │
│                                  │
│ Acesso rápido           Ver tudo │
│ ┌──────────┐ ┌──────────┐        │ ← GRID 2×2 de quick actions
│ │ 📅 Matriz│ │ ✅ Tarefas│        │   cards quadrados, ícone grande,
│ │ 30 dias  │ │  do dia   │        │   título + sublinha, seta canto
│ └──────────┘ └──────────┘        │   borda neon sutil, hover glow
│ ┌──────────┐ ┌──────────┐        │
│ │ 🛠 Ferra-│ │ 💬 Chat   │        │
│ │ mentas   │ │  IA       │        │
│ └──────────┘ └──────────┘        │
│                                  │
│ 🔥 Hype do dia          [↻]      │ ← seção mais enxuta
│ YouTube 25 · Google 10 · Reddit 5│
│ ┌────────────────────────────┐   │   carrossel horizontal OU
│ │ 1  Tema A             →    │   │   lista vertical com top 5,
│ │    por que bombou…         │   │   botão "ver todas as 15" abre
│ └────────────────────────────┘   │   sheet/drawer
│ ┌────────────────────────────┐   │
│ │ 2  Tema B             →    │   │
│ └────────────────────────────┘   │
│ [ Ver todas as 15 tendências ]   │
│                                  │
│ Status                           │ ← rodapé compacto (no lugar dos chips)
│ 🔥 0 dias  ·  🪙 30 coins  ·    │   inline, clicável → /carteira
│ 📈 Plano Gratuito → Assinar      │
└──────────────────────────────────┘
```

## Mudanças concretas

### 1. Header + saudação (`src/pages/Index.tsx`)
- Remover chips de Dia/Streak/Coins do topo (vão para o rodapé "Status").
- Saudação maior, com subtítulo "Como vamos viralizar hoje?" (ou variação por horário).
- Manter logo + 3 ícones (tema/ajuda/sair).

### 2. Hero card — Estratégia do dia
- Promover `todayStrategy` a card hero grande (rounded-3xl, padding generoso, ~180px de altura).
- Background gradient `linear-gradient(135deg, hsl(270 90% 30%), hsl(322 85% 35%))` no dark; versão clara mais suave no light.
- Glow externo `shadow-[0_0_40px_hsl(var(--primary)/0.35)]`.
- Ícone grande do pilar à direita (NicheIcon em tamanho 48–64).
- CTA inline "Abrir roteiro →".

### 3. Grid 2×2 "Acesso rápido" (componente novo: `QuickAccessGrid`)
- 4 cards quadrados (`aspect-square` em mobile, ou h-28 fixo).
- Cada card: ícone grande no topo-esquerda, título serif, subtítulo muted, seta `↗` no canto superior-direito.
- Borda neon sutil (`app-neon-border` já existe).
- Destinos: `/matrix`, `/tasks`, `/tools`, `/ajuda` (ou Chat se houver rota). Usar `Link` do react-router.
- Hover: glow intensifica + leve `translate-y-[-2px]`.

### 4. Hype do dia — enxugar
- Trocar grid de 15 cards por **lista vertical compacta de 5** (top 5 personalizados), com numeração estilo ranking.
- Cada item: número grande à esquerda (text-3xl gradient), título + "por que bombou" (1 linha), badge fonte pequena, chevron.
- Botão "Ver todas as 15 tendências" abre um `Sheet` lateral/bottom com a grid completa agrupada por fonte (reaproveita o layout atual).
- Contadores por fonte continuam no header da seção.

### 5. Rodapé "Status" (substitui os chips do topo)
- Linha horizontal compacta com: `🔥 streak`, `🪙 coins` (link `/carteira`), e — se free — banner inline "Plano Gratuito → Assinar".
- Visual discreto, tipografia pequena, separadores `·`.

### 6. Tokens visuais (`src/index.css`)
- Adicionar utilitário `.app-hero-gradient` (gradient roxo→pink usado no hero).
- Reforçar `.app-neon-border` com variação `.app-neon-border-soft` (glow menor, pra quick access).
- Garantir que tudo funciona em light theme (fallback sem gradientes saturados).

## Arquivos a tocar
- `src/pages/Index.tsx` — reestruturação completa do JSX (sem mexer em hooks/lógica).
- `src/components/QuickAccessGrid.tsx` — **novo**, componente isolado dos 4 cards.
- `src/components/HypeOfTheDay.tsx` — refatorar para modo "compact" (top 5 + botão "ver todas") usando Sheet existente.
- `src/index.css` — utilitários `.app-hero-gradient`, `.app-neon-border-soft`.
- **Não mexer**: backend, edge functions, hooks de dados, auth, paywall.

## O que NÃO entra
- Mascote 3D dos mockups (não temos asset, e gerar fugiria do escopo "redesign de layout"). Substituímos pelo `NicheIcon` grande e pelas orbs neon já existentes no fundo (dark).
- Onboarding/`InstallVideoModal`/`description_status` banner — ficam como estão.

## Perguntas rápidas
1. **Destinos do grid 2×2**: confirmar Matriz / Tarefas / Ferramentas / Chat-IA (ou prefere Carteira / Indique no lugar de algum)?
2. **Hype compacto**: top 5 com botão "ver todas as 15" tá ok, ou prefere carrossel horizontal mostrando todas com swipe?
3. **Mascote**: quer que eu gere uma ilustração/avatar pra usar no hero card (estilo dos mockups), ou seguimos só com ícone do pilar?
