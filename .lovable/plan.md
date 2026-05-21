
## Objetivo
Reformular `/matrix` no padrão das 4 referências (CatMiko, ChatIQ, AI Solutions, Personal AI Buddy): tipografia bold sans, cards bento com tamanhos variados, chips pílula sólidos, ícones em quadrados arredondados coloridos, hero com saudação grande e seções com "See all" inline. Mantém estética neon/purple já presente no app (dark) + variante airy white (light).

## Padrões extraídos das referências
1. **Tipografia**: bold sans-serif (não serif), títulos grandes 28–32px, peso 700–800, line-height apertado. Body 14px regular, muted gray.
2. **Cards bento**: grid assimétrico — 1 card grande destacado (gradient roxo sólido + ícone branco + seta diagonal ↗) ao lado de 2 cards menores empilhados. Cantos 24px.
3. **Chips de filtro**: pílula horizontal scroll, selecionado = preenchido sólido (roxo/preto), demais = outline transparente. Sem emojis dentro.
4. **Seção header**: título + "Ver todos →" alinhado à direita, espaçamento generoso.
5. **List cards**: avatar/ícone quadrado arredondado colorido à esquerda, título + subtítulo, timestamp/chevron à direita. Divider sutil.
6. **Status visual**: badge "Online •" verde, ou "Pro" amarelo dentro do título — usar para marcar dia atual/concluído.
7. **Background**: dark com gradient roxo radial sutil + linhas curvas decorativas; light = branco puro com mesma estrutura.

## Mudanças concretas em `src/pages/Matrix.tsx`

### Header (substitui `gradient-header` atual)
- Remove o bloco roxo gigante com cantos arredondados.
- Saudação top: avatar circular esquerda, "Hi, {nome} 👋" pequena + "Sua matriz de 30 dias" em bold 28px abaixo. Sino/HelpButton direita.
- Logo neon orb sutil no fundo (dark) ou nada (light).

### Bento hero (novo bloco — substitui faixa de filtros como primeiro foco)
Grid 2 colunas, altura ~180px:
```text
┌─────────────┬─────────┐
│             │ Dia hoje│
│  Dia atual  │  ↗      │
│  destaque   ├─────────┤
│  ↗ ícone    │ Próximo │
│             │  ↗      │
└─────────────┴─────────┘
```
- Card grande esquerdo: gradient `from-primary to-accent`, texto branco, label "HOJE • Dia X", título do `todayStrategy.title` em 2 linhas, ícone branco em quadrado glass top-left, seta ↗ top-right.
- 2 cards direita: glass/outline, "Concluídos {n}" e "Próximo • Dia X+1" com mini-título.

### Filtros (refinados)
- Header da seção: "Pilares" bold + "Todos →" direita.
- Chips pílula horizontal scroll. Sem emoji dentro do chip. Selecionado = bg-foreground / text-background sólido (preto no light, branco no dark), demais = border + bg transparente.

### Grid de dias (substitui o atual `grid-cols-2`)
Vira **lista vertical estilo "History"** (ref CatMiko/Personal AI Buddy):
- Card horizontal full-width, 72px altura, rounded-2xl, border sutil.
- Esquerda: quadrado 48x48 rounded-xl com cor do pilar + ícone do nicho (branco).
- Centro: "Dia X" muted text-xs + título bold text-sm (line-clamp-1) + label do pilar text-xs muted.
- Direita: se concluído → check verde; se atual → badge "Hoje" pílula primária; se locked → cadeado + blur leve no título.
- Tap = abre `DayDetailCard` (mantém comportamento).

Removo o blur agressivo nos locked — só ícone cadeado + opacity 60%.

### Tipografia global da tela
- Trocar `font-serif` por sans bold nos títulos desta página (sem mudar tokens globais — só nesta tela usar `font-sans font-bold tracking-tight`).
- Se ok com você, posso introduzir token `--font-display` apontando p/ sans bold só pra essa tela (ou trocar global, mas isso afeta outras telas — confirma).

## Arquivos
- `src/pages/Matrix.tsx` — reescrita do JSX e layout (lógica de filtros/locked/selected mantida).
- `src/index.css` — talvez 1 utilitário novo `.app-bento-card` (gradient + sombra neon).
- Sem mexer em backend, hooks ou outras telas.

## Perguntas rápidas
1. **Tipografia**: aplico sans bold só nesta tela ou troco o `font-serif` global (afeta Index, Wallet, etc.)?
2. **Bento hero**: card grande mostra **dia atual** (recomendado) ou **próximo bloqueado pra induzir upgrade**?
3. **Lista vs grid**: você prefere lista vertical (como acima, mais legível) ou manter grid 2 colunas só com visual novo (cards quadrados grandes estilo bento)?
