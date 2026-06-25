# Corrigir email de boas-vindas sem mexer no de recuperação

**Sim, dá pra resolver sem encostar nos emails de recuperação.** Eles são dois caminhos **totalmente independentes** no seu self-hosted:

| Email | Quem envia | Onde lê SMTP |
|---|---|---|
| Recuperação de senha | container `supabase-auth` (GoTrue) | variáveis `GOTRUE_SMTP_*` |
| Boas-vindas (`send-welcome-email`) | container `supabase-edge-functions` | variáveis `SMTP_*` |

A correção mexe **só no service `functions`** do `docker-compose.yml`. O service `auth` não é tocado, não é recriado, e continua usando exatamente as mesmas `GOTRUE_SMTP_*` que já funcionam hoje.

## Plano (você roda na VPS)

### 1. Adicionar variáveis SMTP_* (sem prefixo) ao `.env`

A edge function lê `SMTP_HOST`, `SMTP_PORT`, etc. — nomes diferentes do GoTrue. Não conflita.

```bash
cd ~/supabase/docker
grep -q '^SMTP_HOST=' .env || cat >> .env <<'EOF'

# Para edge function send-welcome-email (não afeta GoTrue)
SMTP_HOST=acesso.host.servidorsaturno.com.br
SMTP_PORT=587
SMTP_USER=suporte@vyrallab.online
SMTP_PASS=Monster_22#23
SMTP_FROM=suporte@vyrallab.online
SMTP_FROM_NAME=Vyral Lab
EOF
```

### 2. Adicionar 6 linhas no service `functions` do `docker-compose.yml`

Primeiro localize o bloco:

```bash
awk '/^  functions:/,/^  [a-z_-]+:$/' ~/supabase/docker/docker-compose.yml | nl
```

Cole a saída aqui que eu te dou o número exato da linha. O que vai ser inserido dentro do `environment:` do `functions`:

```yaml
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      SMTP_FROM: ${SMTP_FROM}
      SMTP_FROM_NAME: ${SMTP_FROM_NAME}
```

### 3. Recriar **só** o container `functions`

```bash
cd ~/supabase/docker
docker compose --env-file .env up -d --force-recreate functions
```

⚠️ Note: **não** usar `docker compose up -d` sozinho (recriaria outros containers). O argumento `functions` no final isola a operação. O container `supabase-auth` não é tocado → emails de recuperação seguem funcionando sem qualquer downtime ou risco.

### 4. Validar (sem expor senha)

```bash
docker exec supabase-edge-functions sh -c 'echo HOST=$SMTP_HOST PORT=$SMTP_PORT USER=$SMTP_USER FROM=$SMTP_FROM NAME=$SMTP_FROM_NAME'
```

Esperado: 5 valores preenchidos.

### 5. Testar boas-vindas

```bash
curl -X POST https://api.influlab.pro/functions/v1/send-welcome-email \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"mentecomp@gmail.com","displayName":"Teste"}'
```

Esperado: `{"ok":true}` e email na caixa.

### 6. Confirmar que recuperação continua OK

Pedir reset de senha pelo app uma vez para confirmar que nada regrediu.

## Por que é seguro

- `.env` é arquivo, ninguém recarrega sozinho. As novas linhas SMTP_* ficam ignoradas pelo auth (que só lê `GOTRUE_*`).
- O `docker compose up -d --force-recreate functions` recria **apenas** o container nomeado. Os demais (auth, db, kong, etc.) ficam intactos.
- Nenhuma mudança em `MAILER_*`, `GOTRUE_SMTP_*`, templates de Storage, ou no service `auth`.
