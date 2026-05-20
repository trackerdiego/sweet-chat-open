## Rebrand visual: Influlab → Vyral Lab

Trocar todas as ocorrências **visíveis ao usuário** de "Influlab" / "InfluLab" para **"Vyral Lab"**. Manter intactos: domínio `app.influlab.pro`, email `suporte@influlab.pro`, chaves de `localStorage` (`influlab.*`), nomes de variáveis internas e arquivos de memória/edge functions (não aparecem na UI).

### Arquivos a alterar

**Meta / PWA**
- `index.html` — `<title>`, `meta description`, `meta author`, `og:title`, `og:description`, `twitter:title`, `twitter:description` → "Vyral Lab - Sua Matriz de Influência"
- `public/manifest.json` — `name` e `short_name` → "Vyral Lab"

**Landing (`src/pages/Landing.tsx`)**
- `alt` dos avatares (linhas 34-38): "Criador/Criadora Vyral Lab"
- FAQ (127, 128): trocar "InfluLab" por "Vyral Lab"
- `alt` do mockup (242), parágrafo (333), seção depoimentos (384)
- Cards de plano (442, 479): "Vyral Lab Pro"
- Footer (572): "© {ano} Vyral Lab. Todos os direitos reservados."

**Outros componentes da landing**
- `ComparisonTable.tsx` — título "Por que Vyral Lab e não outra coisa?" e header "Vyral Lab" (linha 36). Chave `influlab` do objeto `rows` permanece (interno).
- `GuaranteeBlock.tsx` — "Teste o Vyral Lab por 7 dias."
- `ProductDemoVideo.tsx` — "Veja o Vyral Lab em ação" e `title="Demo Vyral Lab"`
- `VideoTestimonialsGrid.tsx` — texto descritivo

**Páginas internas**
- `Onboarding.tsx` (158, 343) — wordmark "Vyral Lab"
- `ResetPassword.tsx` (50, 63) — wordmark "Vyral Lab"
- `Referral.tsx` (40) — `navigator.share` title "Vyral Lab"
- `Tools.tsx` (417) — explicação do compartilhamento Instagram

**Componentes de instalação**
- `InstallBanner.tsx` (59) — "Adicione o Vyral Lab à tela de início"
- `InstallInstructionsModal.tsx` (61, 104) — "link do Vyral Lab" e "Instale o Vyral Lab no seu celular"
- `InstallVideoModal.tsx` (48) — "seu Vyral Lab vira app"

### Não alterar
- `Help.tsx` linha 28 — `SUPPORT_EMAIL = 'suporte@influlab.pro'` (email real)
- `Navigation.tsx` linhas 55, 108, 281 — email de suporte e chave de localStorage
- `Referral.tsx` linha 7 — `SHARE_BASE` (URL do app)
- `InstallVideoModal.tsx` linha 6 — `SEEN_KEY` localStorage
- `Onboarding.tsx` linhas 79, 96 — `localStorage.removeItem('influlab.onboardingRunId')`
- Edge functions, hooks (`useOnboardingRun`, `useUserProfile`, `useAppTheme`), `supabase/client.ts`, arquivos `.md` e `.lovable/*` — não visíveis ao usuário
- Logo já foi substituída em mensagem anterior

### Pergunta
O email de suporte `suporte@influlab.pro` continua o mesmo, ou também migra para um domínio Vyral Lab (ex.: `suporte@vyrallab.com`)? Se mudar, me passe o novo email.
