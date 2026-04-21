

# Plano: registrar na memória que templates de email estão prontos

## O que vou fazer

Atualizar a memória do projeto pra refletir o estado atual do sistema de emails, evitando que eu (ou futuras sessões) proponha recriar templates ou mexer em fluxo de email desnecessariamente.

## Mudanças de memória

### 1. Atualizar `mem://auth/email-branding`

Substituir conteúdo antigo por estado atual:
- Templates HTML hospedados no bucket público `emails/emails/` do Supabase self-hosted
- 5 templates ativos: `confirmation.html`, `email-change.html`, `invite.html`, `magic-link.html`, `recovery.html`
- URLs configuradas via `MAILER_TEMPLATES_*` no `~/supabase/docker/.env` da VPS
- Envio testado e funcionando
- Frontend NÃO envia corpo de email — apenas dispara `supabase.auth.*` e o GoTrue self-hosted aplica os templates
- `redirectTo` deve ficar sob `https://app.influlab.pro/*` (já está em `Auth.tsx` via `window.location.origin`)

### 2. Atualizar Core do `mem://index.md`

Adicionar uma linha curta no Core:
> Email templates já configurados no Storage self-hosted (bucket `emails/emails/`). Frontend só dispara auth — não recriar templates nem mexer em SMTP.

## O que NÃO faço

- Não toco em código (`Auth.tsx`, `ResetPassword.tsx`, `client.ts` já estão corretos)
- Não recrio HTMLs
- Não gero artefatos
- Não mexo em edge functions de email

## Saída

2 arquivos de memória atualizados. Nenhuma mudança visível no app. Próxima vez que você (ou eu) tocar em qualquer fluxo de auth, vou saber que email está 100% resolvido no servidor.

