## Auth claro + logo correto nas telas de onboarding

### 1. `src/pages/Auth.tsx` — converter para tema claro
- Remover `landing-dark` do `<Shell>` (deixar de forçar tema escuro).
- Remover os dois `<div class="neon-orb">` (efeito neon do fundo escuro).
- Trocar `neon-card` → `glass-card` (3 ocorrências: confirmação, esqueci senha, formulário principal).
- Trocar `neon-cta` → `gold-gradient text-primary-foreground` (3 botões).
- Trocar `neon-chip` (badge de indicação) → versão clara: `inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary px-3 py-1 text-xs font-medium`.
- Substituir cor `text-[hsl(var(--primary-glow))]` por `text-primary` (3 links: "Esqueci senha", "Voltar ao login", "Criar conta/Fazer login").
- Ícone do email no card de confirmação: `text-[hsl(var(--primary-glow))]` → `text-primary`.
- `neon-text` (spans dentro dos h1) → `text-primary`.
- Importar `logoLight` (`@/assets/vyrallab-logo-light.png`) e usar no `<img>` do Shell.
- Ajustar `drop-shadow` do logo (sombra roxa neon não combina com fundo claro): trocar por `drop-shadow-sm` ou remover.

### 2. `src/pages/ResetPassword.tsx` — usar logo branco
- Substituir os dois wordmarks `<span class="font-serif text-2xl font-bold text-primary">Vyral Lab</span>` (linhas 50 e 63) por `<img src={logoLight} alt="Vyral Lab" class="h-10 w-auto mx-auto" />`.
- Importar `logoLight`.

### 3. `src/pages/Onboarding.tsx` — usar logo escuro no header roxo
- O header (`.gradient-header`) tem fundo roxo gradiente → a logo **escura/original** (otimizada para fundo escuro) é a correta.
- Substituir os dois wordmarks `<span class="font-serif text-xl font-bold text-primary">Vyral Lab</span>` (linhas 158 e 343) por `<img src={logoDark} alt="Vyral Lab" class="h-9 w-auto mx-auto" />`.
- Importar `logoDark` de `@/assets/vyrallab-logo-horizontal.png`.

### Não alterar
- `Landing.tsx` — continua escuro (já usa `landing-dark`).
- `Onboarding.tsx` body — já é claro por padrão; só o header roxo recebe a logo escura.
- Index.tsx — toggle de tema já implementado.

Posso aplicar?
