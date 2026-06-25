O problema não é mais o bloco YAML: o `docker compose` está avisando que as variáveis `GOTRUE_SMTP_*` não foram carregadas, então o container `functions` recebe `SMTP_*` vazio e a function retorna `smtp_not_configured`.

Plano de correção manual no VPS:

1. Entrar na pasta do compose antes de recriar o container:
```bash
cd ~/supabase/docker
```

2. Confirmar que o `.env` dessa pasta tem as variáveis:
```bash
grep -E '^GOTRUE_SMTP_(HOST|PORT|USER|ADMIN_EMAIL|SENDER_NAME)=' .env
```
Não rode grep do `PASS` para não expor senha.

3. Se essas linhas não aparecerem, adicionar no arquivo correto:
```bash
nano ~/supabase/docker/.env
```

As variáveis precisam estar no formato `.env`, com `=`:
```bash
GOTRUE_SMTP_ADMIN_EMAIL=suporte@vyrallab.online
GOTRUE_SMTP_HOST=acesso.host.servidorsaturno.com.br
GOTRUE_SMTP_PASS=SUA_SENHA_SMTP
GOTRUE_SMTP_PORT=587
GOTRUE_SMTP_SENDER_NAME=Vyral Lab
GOTRUE_SMTP_USER=suporte@vyrallab.online
```

4. Recriar o container carregando explicitamente o `.env`:
```bash
cd ~/supabase/docker
docker compose --env-file .env -f docker-compose.yml up -d --force-recreate functions
```

5. Validar que o container recebeu as variáveis `SMTP_*`:
```bash
docker exec supabase-edge-functions env | grep -E '^SMTP_(HOST|PORT|USER|FROM|FROM_NAME)=' | sort
```
Não valide `SMTP_PASS` no terminal.

6. Testar novamente:
```bash
curl -X POST https://api.influlab.pro/functions/v1/send-welcome-email \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"mentecomp@gmail.com","displayName":"Teste"}'
```

Resultado esperado: `{"ok":true}`.

Observação importante: os warnings `GOTRUE_SMTP_HOST variable is not set` confirmam que o Docker Compose não está lendo essas variáveis no momento do `up`. Por isso, mesmo com o bloco certo no `functions: environment:`, ele injeta vazio.