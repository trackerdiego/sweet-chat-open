# Configurar SMTP do Supabase self-hosted → cPanel (vyrallab.online)

DNS já propagou. Agora é apontar o GoTrue (auth) pra mandar os 5 emails (signup, recovery, magic link, invite, email change, reauth) usando a caixa `suporte@vyrallab.online` no servidor `acesso.host.servidorsaturno.com.br`.

**Templates já estão configurados no bucket `emails/emails/` do Storage self-hosted** (memory confirma). Não vou mexer em template — só credenciais SMTP + `From:`.

---

## 1. Variáveis a adicionar/ajustar em `~/supabase/docker/.env`

```env
# ===== SMTP (envio dos emails de auth) =====
GOTRUE_SMTP_HOST=acesso.host.servidorsaturno.com.br
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=suporte@vyrallab.online
GOTRUE_SMTP_PASS=__COLAR_SENHA_DA_CAIXA__
GOTRUE_SMTP_ADMIN_EMAIL=suporte@vyrallab.online
GOTRUE_SMTP_SENDER_NAME=Vyral Lab
GOTRUE_MAILER_AUTOCONFIRM=false
```

> **Importante sobre a porta**: cPanel cPanel normalmente aceita `465 (SSL)` ou `587 (STARTTLS)`. GoTrue usa SSL implícito na 465. Se 465 falhar com `EOF`/timeout, troca pra `587` (o GoTrue detecta STARTTLS automaticamente).

> **`MAILER_AUTOCONFIRM=false`** mantém o fluxo atual de signup sem confirmação de email exigida — só ajusta caso queira mudar.

## 2. Conferir se `SITE_URL` e redirect list já estão certos

Você já colou antes que estão:
```env
SITE_URL=https://app.influlab.pro
ADDITIONAL_REDIRECT_URLS=https://app.vyrallab.online,https://app.vyrallab.online/*,https://app.influlab.pro,https://app.influlab.pro/*,http://localhost:5173
GOTRUE_URI_ALLOW_LIST=https://app.vyrallab.online,https://app.vyrallab.online/*,https://app.influlab.pro,https://app.influlab.pro/*
```

**Decisão**: trocar `SITE_URL` pra `https://app.vyrallab.online`? Os links nos emails (reset de senha etc.) usam `SITE_URL` como base. Se o domínio principal agora é o `vyrallab.online`, esse deve ser o `SITE_URL`. O `app.influlab.pro` fica como redirect adicional (continua funcionando pra login, só não é o default dos links de email).

→ Vou recomendar essa troca no bloco final. Se quiser manter `influlab.pro` como primário, é só não mexer.

## 3. Subir o auth

```bash
cd ~/supabase/docker
cp .env .env.bak.$(date +%F-%H%M%S)
nano .env   # colar as 7 linhas SMTP_* + ajustar SITE_URL se quiser
docker compose up -d --force-recreate auth
docker compose logs --tail=80 auth | grep -iE 'smtp|mail|error'
```

Se nos logs aparecer `"msg":"GoTrue API started"` sem erro de SMTP, tá ok. Erros típicos:
- `dial tcp ... i/o timeout` → porta bloqueada na VPS (testar `nc -vz acesso.host.servidorsaturno.com.br 465`)
- `535 Authentication failed` → senha errada
- `unencrypted connection` → trocar porta 465↔587

## 4. Smoke test (3 minutos)

1. Em `app.vyrallab.online/auth` → "Esqueci minha senha" → digitar email real → deve chegar
2. Conferir no email: remetente = `Vyral Lab <suporte@vyrallab.online>`, link aponta pro `SITE_URL` configurado
3. Conferir cabeçalho do email recebido: `SPF=pass` e `DKIM=pass` (se DKIM falhar = falta gerar registro no cPanel → Email Deliverability)

## 5. (Opcional) Senha como secret

Se preferir não deixar a senha SMTP em texto puro no `.env`, dá pra mover pro Vault do Postgres, mas o GoTrue lê direto de env var — então o `.env` é o lugar certo. Apenas garanta permissão `chmod 600 ~/supabase/docker/.env`.

---

## O que eu preciso de você antes de gerar o bloco final pra colar na VPS:

1. **Senha da caixa `suporte@vyrallab.online`** — você cola direto no `nano .env` na VPS, **não me envia**.
2. **Confirmar `SITE_URL`**: troco pra `https://app.vyrallab.online` ou mantenho `https://app.influlab.pro`?
3. **Porta SMTP**: tento 465 primeiro (padrão), ok?

Aprova e eu te devolvo o bloco final pronto pra colar.
