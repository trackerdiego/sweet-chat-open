
## Objetivo
Transformar a tela inicial (`/`) num painel mais moderno, com a estética neon da landing, dando protagonismo total às tendências (Hype do Dia) e removendo blocos que você considera ruído.

## O que sai
- `MonthlyProgress` (Progresso do Mês)
- `StreakCounter` (Sequência + 7/14/30 dias + coins inline)
- `WeeklyView` (Visão Semanal D29/D30…)
- `MindsetPulse` ("Dose de Coragem") — sai do topo, vira rodapé discreto (decisão: manter pequeno no fim, ou remover; ver pergunta abaixo)

## O que fica / muda
- **Header**: logo + ações (tema/ajuda/sair) — mantido, sem o "Dia X de 30" gigante (vira chip pequeno).
- **Saudação "Olá, Diego 👑"** — mantida, mais compacta.
- **Card "Atualização Digital" (vídeo 13%)** — mantido (é onboarding/guia).
- **Card do dia (estratégia + barra de progresso)** — mantido, mas com borda neon.
- **Hype do Dia** — vira **HERO**:
  - Mostra **todas as tendências coletadas** (não só 5), agrupadas por fonte (YouTube, Google Trends, Reddit) com contadores.
  - Layout em **grid de cards** com borda neon (purple→pink gradient glow), não mais lista comprimida.
  - Cada card: número/rank, tema (título grande), por que bombou (2 linhas), badge de fonte + formato sugerido, hover com glow intensificado.
  - Botão "atualizar" no header da seção.
  - Tap no card abre o sheet existente com gancho/ângulo/copiar.
- **Mini-stats inline** (substituindo Sequência/Progresso/Semanal): uma faixa fina no topo com 3 chips neon — `Dia X/30` · `Y dias seguidos` · `Z coins`. Sem cards gigantes, só informação densa. Clicáveis levam para Matrix/Carteira.

## Estética (neon da landing)
- Mesmo padrão das `neon-orb` (já existe no `index.css`) — orbs roxa/magenta no fundo, intensidade maior.
- Cards com **borda gradient animada** (purple `270 95% 65%` → pink `322 90% 60%`), shadow `0 0 24px hsl(var(--primary)/0.25)`.
- Glassmorphism mantido mas com `backdrop-blur` mais forte e bordas de 1px com gradiente neon (CSS `border-image` ou pseudo-elemento `::before` com mask).
- Tipografia serif para títulos (já é o padrão), sans para corpo.

## Estrutura visual (mobile, viewport real ~390px)

```text
┌──────────────────────────────┐
│ logo            ☾ ? ⎋        │
│ ▸ chip: D30/30  🔥 0  🪙 30  │
│ Olá, Diego 👑                │
├──────────────────────────────┤
│ [Plano Gratuito → Assinar]   │
│ [▶ Atualização Digital 13%]  │
│ [Card do dia (estratégia)]   │
├──────────────────────────────┤
│ 🔥 HYPE DO DIA      [↻]      │
│  YouTube 25 · Google 10 · …  │
│ ┌──────────┐ ┌──────────┐    │
│ │ 1 Tema A │ │ 2 Tema B │    │
│ │ neon border │ neon border │
│ └──────────┘ └──────────┘    │
│ ┌──────────┐ ┌──────────┐    │
│ │ 3 …      │ │ 4 …      │    │
│ └──────────┘ └──────────┘    │
│ … (todos os itens)           │
└──────────────────────────────┘
```

## Mudança no backend de Hype (mínima)
Hoje `start-hype-job` pede pra Gemini retornar exatamente 5 itens. Pra "mostrar todas", duas opções:
- **A (recomendada)**: aumentar pra **15 itens** no prompt (top 15 já dá sensação de abundância sem custar muito token). Mantém personalização.
- **B**: mostrar também os raw trends de `daily_hype_raw` (sem personalização do Gemini), agrupados.

Vou seguir **A**, e se quiser depois adiciono uma aba "Cru" com os raw.

## Arquivos a tocar
- `src/pages/Index.tsx` — remover imports/JSX de Monthly/Streak/Weekly/Mindset; nova faixa de chips; reordenar.
- `src/components/HypeOfTheDay.tsx` — novo layout grid, borda neon, contador por fonte, render de N itens (não fixo em 5).
- `src/index.css` — utilitário `.neon-border` (gradient border + glow) se ainda não existe.
- `supabase/functions/start-hype-job/index.ts` — trocar "5 itens" por "15 itens" no prompt + schema.
- (sem migrations, sem mexer em auth/pagamento/onboarding)

## Perguntas rápidas antes de implementar
1. **"Dose de Coragem"** (citação diária) — remover também ou manter como rodapé discreto?
2. Quantos itens no Hype: **15** (recomendado) ou outro número?
3. Manter o card **"Atualização Digital"** (vídeo de boas-vindas) no topo, ou também enxugar?
