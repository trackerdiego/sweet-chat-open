## Aplicar estilo neon dark no Painel principal

Replicar o visual da landing/login (`landing-dark`, `neon-orb`, `neon-card`, `neon-cta`, `neon-text`, logo horizontal com glow roxo) na tela `/` (Index.tsx) e na navegação principal.

### Arquivos afetados

**1. `src/pages/Index.tsx`** — dashboard logado
- Wrapper: adicionar `landing-dark` no container raiz
- Header: trocar `gradient-header` por fundo escuro com 1–2 `neon-orb` posicionados e gradiente radial sutil roxo
- Substituir saudação "Olá, {name} 👑" para usar `neon-text` no nome
- Botões ghost do header (ajuda/sair): manter ícones, ajustar hover para `hover:bg-white/5`
- Card "Plano Gratuito": trocar `glass-card` por `neon-card`, ícone Crown com `bg-primary/15 border-primary/40`, botão "Assinar" passa de `gold-gradient` para `neon-cta`
- Card "descrição pendente": `neon-card` com tom de aviso (manter amber mas sobre fundo escuro), botão outline com borda neon
- Card de hoje (Link to /script): `neon-card` com hover glow, barra de progresso usando `bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))]` no lugar de `gold-gradient`
- Skeleton inicial: ajustar fundo do header skeleton pro novo esquema

**2. `src/components/Navigation.tsx`** — bottom nav / top nav
- Fundo: `bg-[hsl(var(--background))]/80 backdrop-blur` com borda `border-white/10`
- Item ativo: trocar `gold-gradient + text-primary-foreground` por `neon-cta` (gradiente roxo→magenta + halo)
- Badge de coins: trocar `bg-primary` por gradiente neon
- Manter toda a lógica (dropdowns, dialogs, push, reset perfil, ajuda assinatura) intacta

**3. Subcomponentes do painel** (ajustes mínimos pra harmonizar com fundo escuro)
- `MonthlyProgress`, `StreakCounter`, `MindsetPulse`, `WeeklyView`: trocar `glass-card` interno por `neon-card` quando aplicável; barras/acentos passam a usar `--primary` + `--primary-glow` no lugar de `gold-gradient`
- Sem mudanças de layout ou conteúdo, só tokens visuais

### Fora do escopo

- Nenhuma mudança em lógica, hooks (`useInfluencer`, `useUserStrategies`, `useUserUsage`, `useSubscription`), Supabase, rotas, CheckoutModal, InstallVideoModal
- Não mexer em `index.css` (tokens `landing-dark`, `neon-*` já existem da landing)
- Não tocar nas demais páginas (Matrix, Script, Tools, Tasks, Wallet, Admin, etc.) — se você quiser estender depois, peço confirmação separada

### Pontos a confirmar
1. Quer que eu inclua **todas** as sub-páginas do app logado (Matrix, Script, Tasks, Tools, Wallet, Help, Onboarding, Renew) no mesmo esquema, ou só o Painel + Navigation por enquanto?
2. O `gold-gradient` aparece em vários lugares do app — substituo globalmente por neon ou só nos pontos do Painel/Nav?
