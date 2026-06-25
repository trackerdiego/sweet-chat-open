
# Expor SMTP ao container `functions` (valores confirmados)

## Diagnóstico
GoTrue tem as vars SMTP no env dele. Container `functions` não tem nenhuma. Precisa adicionar no `docker-compose.yml`. Sem mudança de código.

Valores confirmados:
- Host: `acesso.host.servidorsaturno.com.br`
- Port: `587` (STARTTLS, a function já trata)
- User/From: `suporte@vyrallab.online`
- Pass: `Monster_22#23`
- Sender name: `Vyral Lab`

## Passos na VPS

1. **Editar `~/supabase/docker/docker-compose.yml`** — no service `functions:`, dentro de `environment:`, adicionar essas 6 linhas (referenciando o `.env` que já tem as `GOTRUE_SMTP_*`):

```yaml
      SMTP_HOST: ${GOTRUE_SMTP_HOST}
      SMTP_PORT: ${GOTRUE_SMTP_PORT}
      SMTP_USER: ${GOTRUE_SMTP_USER}
      SMTP_PASS: ${GOTRUE_SMTP_PASS}
      SMTP_FROM: ${GOTRUE_SMTP_ADMIN_EMAIL}
      SMTP_FROM_NAME: ${GOTRUE_SMTP_SENDER_NAME}
```

2. **Recriar o container**:

```bash
docker compose -f ~/supabase/docker/docker-compose.yml up -d --force-recreate functions
```

3. **Validar**:

```bash
docker exec supabase-edge-functions env | grep -E "^SMTP_" | sort
```

Deve listar as 6 vars com os valores certos.

4. **Re-testar**:

```bash
curl -X POST https://api.influlab.pro/functions/v1/send-welcome-email \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"mentecomp@gmail.com","displayName":"Teste"}'
```

Esperado: `{"ok":true}` + email entrando na caixa do `mentecomp@gmail.com` vindo de `Vyral Lab <suporte@vyrallab.online>`.

## Se der erro de conexão SMTP (não `smtp_not_configured`)
Me cola a saída do log:
```bash
docker logs supabase-edge-functions --tail 50 | grep -i "welcome\|smtp"
```
Daí eu ajusto STARTTLS/timeout na function se for o caso.

## Fora de escopo
- Não mexer em GoTrue, templates de auth, ou código da function (ela já tá certa).
- Não vou colocar senha SMTP em arquivo committado — fica só no `.env` da VPS, referenciado por `${...}` no compose.
