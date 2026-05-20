Dois erros novos, ambos solucionáveis:

## Erro 1 (request 19:06:18) — certificado x509
```
tls: failed to verify certificate: x509: certificate is valid for
acesso.host.servidorsaturno.com.br, not mail.vyrallab.online
```

O servidor SMTP do Saturno apresenta certificado emitido para `acesso.host.servidorsaturno.com.br`, não para `mail.vyrallab.online`. Confirmamos isso nos testes openssl anteriores. O Go SMTP no STARTTLS faz validação estrita de hostname, então a conexão é abortada.

**Fix:** trocar `SMTP_HOST` para o nome real do certificado: `acesso.host.servidorsaturno.com.br`. O envelope From (`SMTP_ADMIN_EMAIL=suporte@vyrallab.online`) continua o mesmo — só muda o host de transporte.

## Erro 2 (requests 19:06:59 e 19:07:53) — rate-limit
```
421 Too many concurrent SMTP connections; please try again later.
```

Saturno limita conexões concorrentes por conta SMTP. Cada clique de "esqueci senha" abriu uma conexão; como as anteriores falharam por TLS, ficaram penduradas. Depois de corrigir o host (erro 1), basta esperar ~1 minuto e o limite reseta.

## Correção (copia e cola na VPS)

```bash
cd ~/supabase/docker

cp .env .env.bak-smtp-host-$(date +%s)

# Troca host para o nome do certificado
sed -i 's|^SMTP_HOST=mail\.vyrallab\.online$|SMTP_HOST=acesso.host.servidorsaturno.com.br|' .env

echo "=== confere .env ==="
grep -E "^(SMTP_HOST|SMTP_PORT|SMTP_USER|SMTP_ADMIN_EMAIL|SMTP_SENDER_NAME|SMTP_SECURE)=" .env
```

Agora ajusta o `extra_hosts` no docker-compose: como mudamos o hostname, o pin IPv4 anterior (`mail.vyrallab.online:204.13.236.90`) não serve mais. Confere o IP atual do novo host e atualiza:

```bash
NEW_IP=$(getent ahostsv4 acesso.host.servidorsaturno.com.br | awk '{print $1; exit}')
echo "IP IPv4 do novo host: $NEW_IP"

# Substitui o pin antigo pelo novo no service auth
sed -i "s|mail\.vyrallab\.online:204\.13\.236\.90|acesso.host.servidorsaturno.com.br:${NEW_IP}|" docker-compose.yml

echo "=== confere extra_hosts ==="
grep -A2 extra_hosts docker-compose.yml | head -20
```

Recria e valida:

```bash
docker compose up -d --force-recreate auth

for i in $(seq 1 20); do
  docker exec supabase-auth sh -lc 'pgrep -f auth >/dev/null' 2>/dev/null && break
  sleep 1
done

docker exec supabase-auth getent hosts acesso.host.servidorsaturno.com.br
docker exec supabase-auth sh -lc 'env | grep -E "GOTRUE_SMTP_(HOST|PORT|USER|SECURE)"'

echo ""
echo "=== ESPERA 90s para o 421 do Saturno resetar ==="
for i in $(seq 1 90); do printf "."; sleep 1; done; echo ""

echo "=== teste TLS direto contra o novo host ==="
timeout 8 openssl s_client -starttls smtp -connect acesso.host.servidorsaturno.com.br:587 -servername acesso.host.servidorsaturno.com.br </dev/null 2>&1 | grep -E "verify return|subject=|CN ="
```

Depois pede reset de senha **uma vez só** e roda:

```bash
sleep 5
docker logs supabase-auth --since 2m 2>&1 \
  | grep -iE "recover|smtp|tls|x509|421|status\":5" | tail -20
```

## Atualização da memória depois que funcionar

Acrescento ao playbook `mem://infra/auth-smtp-ipv6-template-trap` que o `SMTP_HOST` correto pro Saturno é `acesso.host.servidorsaturno.com.br` (CN do certificado), não o vanity `mail.vyrallab.online`, e que cada retry consome slot do limite de conexão concorrente — então debug sempre com pausa de 1 min entre tentativas.