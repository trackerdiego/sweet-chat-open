

# Continuar: Aplicar branding InfluLab e fazer deploy

## Situacao Atual
- O scaffold rodou com sucesso (dominio `notify.app.influlab.pro` alinhado)
- Mas os templates voltaram ao padrao: ingles, cores pretas, `SITE_NAME = "sweet-chat-open"`
- Falta reaplicar o branding e fazer deploy

## Plano

### 1. Atualizar auth-email-hook/index.ts
- `SITE_NAME` → `"InfluLab"`
- `SAMPLE_PROJECT_URL` → `"https://app.influlab.pro"`
- `EMAIL_SUBJECTS` → traduzir para PT-BR:
  - signup: "Confirme seu e-mail"
  - recovery: "Redefinir sua senha"
  - magiclink: "Seu link de acesso"
  - invite: "Voce foi convidado(a)"
  - email_change: "Confirme seu novo e-mail"
  - reauthentication: "Seu codigo de verificacao"

### 2. Aplicar branding nos 6 templates
- Cores da marca: primary `hsl(258, 60%, 55%)`, foreground `hsl(260, 20%, 15%)`, muted `hsl(260, 10%, 45%)`
- Botao: `backgroundColor: 'hsl(258, 60%, 55%)'`, `borderRadius: '1rem'`
- Font: `'Inter, Arial, sans-serif'`
- Traduzir todo o conteudo para PT-BR
- Templates: signup, recovery, magic-link, invite, email-change, reauthentication

### 3. Deploy do auth-email-hook
- Fazer deploy para ativar as mudancas

### 4. Validar
- Verificar nos previews que o branding esta correto

## Detalhes Tecnicos
- Primary: `hsl(258, 60%, 55%)` — botoes e destaques
- Primary-foreground: `hsl(0, 0%, 100%)` — texto nos botoes
- Foreground: `hsl(260, 20%, 15%)` — titulos
- Muted-foreground: `hsl(260, 10%, 45%)` — texto do corpo
- Border-radius: `1rem`
- Font: Inter com fallback Arial

