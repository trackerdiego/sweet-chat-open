# Email de boas-vindas pós-pagamento

## Contexto

Hoje os emails de auth (recovery, signup) saem pelo **GoTrue self-hosted** usando SMTP `mail.vyrallab.online` + templates em Storage (`emails/emails/`). Esse fluxo é exclusivo do GoTrue — não dá pra "pendurar" um email transacional nele.

Pra disparar um welcome após `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED`, criamos uma edge function curtinha que usa **o mesmo servidor SMTP** (mesmas credenciais já no `.env` da VPS), só que chamada direto pelo webhook do Asaas. Nada muda no GoTrue.

## Escopo

1. **Nova coluna** `subscription_state.welcome_email_sent_at TIMESTAMPTZ` — garante idempotência (não reenvia se webhook chegar 2x ou se cliente renovar).
2. **Nova edge function** `send-welcome-email`:
  - Recebe `{ userId, email, displayName }`.
  - Conecta no SMTP `mail.vyrallab.online` via `denomailer` usando `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (mesmas vars já usadas pelo GoTrue, expostas ao container `functions` via `docker-compose.yml`).
  - Envia HTML inline com branding VyralLab (roxo `#8B5CF6`, glassmorphism leve), CTA grande **"Acessar VyralLab"** → `https://app.vyrallab.online`.
  - Corpo destaca: link salvo nos favoritos, instruções rápidas de instalar PWA, suporte.
3. **Hook no `asaas-webhook**`: no bloco `PAYMENT_CONFIRMED/PAYMENT_RECEIVED` (linha ~369), depois de marcar `is_premium=true`, checar `welcome_email_sent_at`. Se NULL → buscar email/nome do user (`auth.users` via service role) → invocar `send-welcome-email` → setar timestamp. Falha no envio não derruba o webhook (try/catch, log apenas).
4. **Entrega VPS**: bloco copia-e-cola no final com `git pull` + `./scripts/deploy-selfhost.sh send-welcome-email asaas-webhook` + SQL do `ALTER TABLE` pro Studio self-hosted.

## Conteúdo do email (rascunho)

- **Assunto**: "Bem-vindo(a) ao VyralLab — seu acesso está liberado 🚀"
- **Pré-header**: "Salve este email: aqui mora seu link de acesso sempre que precisar."
- **Corpo**: saudação personalizada → "seu plano está ativo" → CTA `https://app.vyrallab.online` → seção "Perdeu o app? Instale o PWA" com 1 linha por SO → assinatura VyralLab.

## Fora de escopo

- Não mexer em GoTrue/templates de auth.
- Não usar Lovable Emails (projeto é self-hosted, ferramenta não chega lá).
- Não enviar em renovação/upgrade — só no primeiro pagamento confirmado (controlado pelo timestamp).

## Detalhes técnicos

- Edge function usa `denomailer` (`https://deno.land/x/denomailer@1.6.0/mod.ts`), STARTTLS na porta 587.
- Idempotência dupla: timestamp + check `is_premium` já era false antes (evita disparar pra reativação manual da equipe).
- Sem novas secrets: SMTP_* já existem no `.env` da VPS; basta confirmar que estão no `environment:` do service `functions` (se não estiverem, instruo no bloco de entrega).

## Pergunta única antes de implementar

Confirmar o remetente visível: usa o mesmo `no-reply@vyrallab.online` (ou similar) que já manda os emails de auth, ou quer um endereço próprio tipo `boasvindas@vyrallab.online`? pode usar o memso `no-reply@vyrallab.online`