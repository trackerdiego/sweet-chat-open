

# Plano: gerar 5 templates HTML branded InfluLab pra Storage self-hosted

## O que vou entregar

5 arquivos HTML standalone com sua logo InfluLab embutida, prontos pra você subir no bucket do Supabase self-hosted e apontar no GoTrue. Mais 1 arquivo da logo separado pra você subir junto.

## Templates incluídos

| Arquivo | Uso no GoTrue | Assunto sugerido |
|---|---|---|
| `recovery.html` | `MAILER_TEMPLATES_RECOVERY` | Redefinir sua senha |
| `confirmation.html` | `MAILER_TEMPLATES_CONFIRMATION` | Confirme seu cadastro |
| `magic-link.html` | `MAILER_TEMPLATES_MAGIC_LINK` | Seu link de acesso |
| `invite.html` | `MAILER_TEMPLATES_INVITE` | Você foi convidado |
| `email-change.html` | `MAILER_TEMPLATES_EMAIL_CHANGE` | Confirme seu novo e-mail |

Mais:
- `influlab-logo.png` — sua imagem copiada pra `/mnt/documents/email-templates/`

## Design

Branding extraído da memória + index.css do projeto:
- Fundo email: `#ffffff` (regra universal)
- Acento primário: `hsl(258, 60%, 55%)` (roxo InfluLab)
- Título: `hsl(260, 20%, 15%)`
- Corpo: `hsl(260, 10%, 45%)`
- Footer: `#999999`
- Botão CTA: roxo sólido, `border-radius: 12px`, padding 14px 28px, fonte branca bold
- Logo no topo, centralizada, max-width 180px
- Largura container 600px, fonte Inter com fallback Arial
- Faixa fina com gradiente roxo→violeta como acento visual

## Estrutura técnica

- HTML puro com **inline styles** (Outlook/Gmail mobile/iOS Mail exigem)
- Layout em `<table>` (não flexbox/grid — clientes de email quebram)
- Sem `<style>` no `<head>` (Gmail strip-a)
- Logo via `<img>` apontando pra URL pública do bucket — placeholder `{{LOGO_URL}}` que você substitui pelo URL real após upload
- Placeholders GoTrue padrão Supabase self-hosted:
  - `{{ .ConfirmationURL }}` → URL do botão CTA
  - `{{ .Email }}` → email do destinatário (rodapé)
  - `{{ .SiteURL }}` → link do app no footer
  - `{{ .Token }}` → código OTP (não usado nesses 5, mas reservado)

## Como vou gerar

1. Copio sua logo de `user-uploads://` pra `/mnt/documents/email-templates/influlab-logo.png`
2. Crio os 5 arquivos HTML em `/mnt/documents/email-templates/`
3. QA: converto cada HTML pra imagem e inspeciono visual (renderizo com headless chrome, viro PNG, vejo se logo, botão, espaçamento e cores estão corretos)
4. Empacoto tudo num `.zip` em `/mnt/documents/influlab-email-templates.zip` pra você baixar de uma vez

## Saída final

Você recebe 2 artefatos:
- `influlab-email-templates.zip` → contém os 5 HTMLs + a logo PNG
- Mensagem com instruções de:
  1. Subir tudo no bucket público do seu Supabase self-hosted
  2. Pegar o URL público da logo e fazer find/replace de `{{LOGO_URL}}` nos 5 HTMLs
  3. Apontar cada template no `~/supabase/docker/.env` do GoTrue

## O que NÃO faço

- Não toco no código do app
- Não crio edge function
- Não mexo no `auth-email-hook` (esse é do fluxo Lovable Email, irrelevante pro self-hosted GoTrue)
- Não envio email — só gero os arquivos

