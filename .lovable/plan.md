## Toggle de tema claro/escuro no app interno

### Comportamento
- Botão de toggle (ícone sol/lua) no header do Painel (`Index.tsx`), ao lado dos botões de ajuda/sair.
- Estado persistido em `localStorage` (`influlab.theme` = `"dark"` | `"light"`). Default: **claro** (volta ao visual original legível); usuário escolhe escuro se quiser.
- Aplicado globalmente no app autenticado: tudo dentro de rotas logadas (Painel, Matriz, Script, Tarefas, Ferramentas, Carteira, etc.) e a `Navigation` respeitam o tema.
- `/auth` e `/landing` continuam **sempre escuras** (identidade da marca pública, sem toggle).

### Implementação

**1. Novo hook `src/hooks/useAppTheme.ts`**
- Lê/escreve `localStorage.influlab.theme`.
- Aplica/remove a classe `landing-dark` em `document.documentElement` via `useEffect`.
- Expõe `{ theme, toggle, setTheme }`.
- Inicialização síncrona (lazy state) pra evitar flash.

**2. `src/pages/Index.tsx`**
- Remover `landing-dark` do wrapper raiz (vai vir do `<html>`).
- Adicionar botão toggle no header (ícone `Sun`/`Moon` do lucide), entre `HelpCircle` e `LogOut`.
- Orbs neon só aparecem quando `theme === 'dark'`.

**3. `src/components/Navigation.tsx`**
- Remover `landing-dark` hard-coded e o fundo escuro fixo.
- Trocar por classes condicionais: no claro usa `bg-card border-border` + item ativo `gold-gradient`; no escuro mantém `bg-[hsl(265_50%_6%/0.85)]` + `neon-cta`.
- Lê o hook `useAppTheme`.

**4. Subcomponentes do Painel** (`MonthlyProgress`, `StreakCounter`, `MindsetPulse`, `WeeklyView`)
- Hoje estão com `neon-card` + cores neon hard-coded. Como `neon-card` só é estilizado dentro de `.landing-dark`, no modo claro ele vira um div sem estilo.
- Solução: trocar `neon-card` por `glass-card` e remover refs diretas a `hsl(var(--primary-glow))`. Como esses componentes ficam dentro do wrapper que tem `landing-dark` no modo escuro, o `glass-card` (que já usa tokens `--card`, `--border`) automaticamente se adapta — no escuro fica com fundo escuro, no claro com fundo claro. Mesma lógica pros ícones (`text-primary` em vez de `text-[hsl(var(--primary-glow))]`).
- Barras de progresso e milestones: usar gradiente baseado em `--primary` → `--accent` (esses tokens já mudam entre claro e escuro automaticamente via `landing-dark` override).

**5. `src/pages/Auth.tsx` e `src/pages/Landing.tsx`**
- Sem mudança. Continuam `landing-dark` fixo.

### Tokens
- Não criar tokens novos. Reusar `--primary`, `--accent`, `--card`, `--border`, `--muted` (já definidos em `:root` claro e `.landing-dark` escuro).
- Gradiente "neon/gold": usar `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))` — funciona nos dois temas (roxo→magenta no escuro, roxo→roxo no claro).

### Fora do escopo
- Nenhuma mudança em lógica, hooks de dados, Supabase, rotas.
- Não tocar em `Landing`, `Auth`, ou nas edge functions.
- Sem tema "auto/sistema" — só toggle manual binário (pode ser adicionado depois se quiser).

### Pergunta antes de implementar
Default inicial: **claro** (parto do que você disse — escuro está difícil de ler) ou **escuro** (mantém o visual atual e o usuário escolhe trocar)?
