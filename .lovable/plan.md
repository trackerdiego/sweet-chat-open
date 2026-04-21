

# Plano: gerar 5 arquivos HTML individuais com branding InfluLab premium

## Mudança de abordagem

Sem ZIP. Cada template entregue como arquivo individual em `/mnt/documents/`, pra você baixar um por um e subir no bucket `emails/templates/` do seu Supabase self-hosted.

## Logo confirmada

```
https://api.influlab.pro/storage/v1/object/public/emails/imagens/influlab-logo.png
```
(você renomeia o arquivo no bucket pra esse nome — sem espaços/vírgulas/parênteses)

## Branding aplicado em todos os 5

Estética premium alinhada ao app:
- **Header**: faixa com gradiente roxo→violeta (`hsl(258 60% 55%)` → `hsl(280 70% 60%)`), logo centralizada (180px max)
- **Container**: 600px, fundo branco `#ffffff`, sombra sutil, bordas arredondadas 16px
- **Título**: peso 700, `hsl(260 20% 15%)`, 24px
- **Corpo**: `hsl(260 10% 45%)`, 15px, line-height 1.6
- **Card de destaque** (varia por template): caixa com fundo `hsl(258 60% 97%)`, borda esquerda roxa 4px, contendo info-chave (link expira em X, email novo, etc)
- **CTA Button**: roxo sólido `hsl(258 60% 55%)`, branco, padding 16px 32px, radius 12px, sombra
- **Divisor**: linha sutil `hsl(260 10% 92%)`
- **Footer**: logo pequena monocromática + tagline "InfluLab — sua plataforma de criação estratégica" + link app + aviso "se não foi você, ignore"
- **Layout em `<table>` + inline styles** (compat Outlook/Gmail/iOS Mail)
- **Preheader text** invisível pra preview do inbox

## Os 5 arquivos

| Arquivo | Tom | Destaque visual |
|---|---|---|
| `recovery.html` | Segurança | Card "Este link expira em 1 hora" + ícone 🔐 no header |
| `confirmation.html` | Boas-vindas | Card "Quase lá!" + ícone ✨ + linha "próximo passo: criar sua matriz estratégica" |
| `magic-link.html` | Praticidade | Card "Acesso rápido sem senha" + ícone 🔗 |
| `invite.html` | Convite | Card "Você foi convidado(a)" + ícone 🎉 + tom celebratório |
| `email-change.html` | Confirmação dupla | Card mostrando email antigo → email novo + ícone 📧 |

## Placeholders GoTrue (mantidos)

- `{{ .ConfirmationURL }}` — href do CTA
- `{{ .Email }}` — email atual
- `{{ .NewEmail }}` — email novo (só email-change)
- `{{ .SiteURL }}` — link footer

## QA antes de entregar

Renderizar cada HTML em PNG via headless Chromium e inspecionar:
- Logo carrega da URL real
- Gradiente roxo aparece no header
- CTA roxo sólido com texto legível
- Card de destaque com borda esquerda visível
- Footer alinhado
- Sem overflow / texto cortado

## Saída

5 artefatos individuais em `/mnt/documents/`:
- `recovery.html`
- `confirmation.html`
- `magic-link.html`
- `invite.html`
- `email-change.html`

Cada um anunciado com seu próprio bloco `<lov-artifact>` pra download direto.

## Próximos passos pós-entrega

1. Renomear logo no bucket pra `influlab-logo.png`
2. Subir os 5 HTMLs em `emails/templates/` no Storage
3. Apontar no `~/supabase/docker/.env`:
   ```
   GOTRUE_MAILER_TEMPLATES_RECOVERY=https://api.influlab.pro/storage/v1/object/public/emails/templates/recovery.html
   GOTRUE_MAILER_TEMPLATES_CONFIRMATION=https://api.influlab.pro/storage/v1/object/public/emails/templates/confirmation.html
   GOTRUE_MAILER_TEMPLATES_MAGIC_LINK=https://api.influlab.pro/storage/v1/object/public/emails/templates/magic-link.html
   GOTRUE_MAILER_TEMPLATES_INVITE=https://api.influlab.pro/storage/v1/object/public/emails/templates/invite.html
   GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE=https://api.influlab.pro/storage/v1/object/public/emails/templates/email-change.html
   ```
4. `cd ~/supabase/docker && docker compose up -d --force-recreate auth`

## O que NÃO faço

- Não gero ZIP
- Não toco no código do app, edge functions, ou auth-email-hook
- Não embuto base64
- Não chamo ferramentas de email_domain (irrelevantes pro fluxo GoTrue self-hosted puro)

