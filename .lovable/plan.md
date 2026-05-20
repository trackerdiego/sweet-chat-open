O log fechou o diagnóstico: IPv4 e templates estão OK; agora o erro real é SMTP/TLS:

```text
tls: first record does not look like a TLS handshake
```

Isso significa que o Auth está tentando abrir conexão TLS direta, mas a porta configurada está respondendo SMTP em texto puro. O aviso de `GOTRUE_MAILER_EXTERNAL_HOSTS` não é o causador do 500.

Plano de correção:

1. Confirmar a configuração SMTP atual sem expor senha:

```bash
cd ~/supabase/docker

echo "SMTP_HOST=$SMTP_HOST"
echo "SMTP_PORT=$SMTP_PORT"
echo "SMTP_USER=$SMTP_USER"
echo "SMTP_ADMIN_EMAIL=$SMTP_ADMIN_EMAIL"
echo "SMTP_SENDER_NAME=$SMTP_SENDER_NAME"

docker exec supabase-auth sh -lc 'env | grep -E "GOTRUE_SMTP_HOST|GOTRUE_SMTP_PORT|GOTRUE_SMTP_USER|GOTRUE_SMTP_ADMIN_EMAIL|GOTRUE_SMTP_SENDER_NAME|GOTRUE_SMTP_SECURE|SMTP" | grep -v PASS'
```

2. Testar qual modo o servidor realmente aceita:

```bash
echo "=== 465 implicit TLS ==="
timeout 8 openssl s_client -connect mail.vyrallab.online:465 -servername mail.vyrallab.online </dev/null 2>&1 | head -25

echo "=== 587 STARTTLS ==="
timeout 8 openssl s_client -starttls smtp -connect mail.vyrallab.online:587 -servername mail.vyrallab.online </dev/null 2>&1 | head -25
```

3. Aplicar a configuração conforme o resultado:

- Se o teste `587 STARTTLS` mostrar certificado/handshake OK, use `SMTP_PORT=587`.
- Se o teste `465 implicit TLS` mostrar certificado/handshake OK, use `SMTP_PORT=465`.
- Se `465` mostrar banner `220 ...` antes de TLS, essa porta está em modo texto e não serve para TLS implícito no Auth.

4. Depois de ajustar o `.env`, recriar o Auth:

```bash
cd ~/supabase/docker
docker compose up -d --force-recreate auth
```

5. Testar novamente o reset de senha e capturar só o request novo se falhar:

```bash
docker logs supabase-auth --since 3m 2>&1 | grep -iE "Error sending recovery email|tls|smtp|x509|refused|timeout|request_id|status":
```

Observação: como já salvamos o playbook anterior na memória, este novo achado deve ser acrescentado depois: quando aparecer `tls: first record does not look like a TLS handshake`, a causa provável é porta/protocolo SMTP incompatível, não template nem DNS IPv6.