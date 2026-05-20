## Aplicar estilo da landing (dark neon) à tela de Auth

Replicar a identidade visual `.landing-dark` (fundo roxo escuro, orbs flutuantes, neon-card, neon-cta, gradient text, logo Vyral Lab) na tela `/auth`, mantendo toda a lógica (login, signup, esqueci senha, confirmação, referral) intacta.

### Mudanças visuais em `src/pages/Auth.tsx`

1. **Wrapper raiz** ganha `className="landing-dark min-h-screen ..."` para herdar todos os tokens dark da landing.
2. **Background**: substitui o `gradient-header` (header roxo claro arredondado) por:
   - Fundo radial roxo (já vem do `.landing-dark`)
   - Dois `neon-orb` absolutos (um roxo, um magenta) borrados ao fundo para o glow característico
3. **Logo**: trocar `influlab-logo.png` por `vyrallab-logo-horizontal.png` (mesma da nav), centralizada no topo com `drop-shadow` neon roxo, sem o header colorido.
4. **Títulos** ("Boas-vindas de volta", "Crie sua conta", "Recuperar senha", "Verifique seu email"):
   - Usar a palavra-chave em `neon-text` (gradient roxo→magenta)
   - Cor base `text-foreground` (branco no dark)
5. **Card do formulário**: trocar `glass-card` por `neon-card` (borda roxa sutil + hover glow).
6. **Chip de referral**: trocar por `neon-chip` com ícone `Gift`.
7. **Inputs**: já herdam tokens do `.landing-dark` (background/border/foreground escuros) — sem mudança de markup, só validar contraste do placeholder.
8. **Botão principal** ("Entrar" / "Criar Conta" / "Enviar link" / "Já confirmei"): trocar `gold-gradient text-primary-foreground` por `neon-cta` (gradient roxo→magenta com halo).
9. **Links secundários** ("Criar conta", "Fazer login", "Esqueci minha senha", "Voltar ao login"): cor `text-primary-glow` com hover underline.
10. **Ícone do estado de confirmação**: círculo com `bg-primary/15 border border-primary/40` e ícone em `text-primary-glow` no lugar do `bg-primary/10`.
11. **Banner InAppBrowserBanner**: mantém no topo, sem alteração.

### Sem mudanças

- Nenhuma alteração de lógica, validação, hooks, chamadas Supabase, fluxo de referral, redirects, ou tipos.
- Nenhuma alteração em outros componentes/páginas.
- Sem novos arquivos.

### Resultado

Tela `/auth` com a mesma identidade dark/neon da landing: fundo roxo profundo com orbs, logo Vyral Lab no topo com glow, card translúcido com borda roxa, CTA neon roxo→magenta, títulos com palavra em gradient.