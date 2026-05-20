Achei a causa raiz exata.

O banner cru na porta 465 retornou:

```
421 Too many concurrent SMTP connections; please try again later.
```

Isso é **texto puro**, não handshake TLS. O servidor Saturno na 465 está rate-limitando conexões concorrentes e, quando isso acontece, ele responde em texto antes do handshake TLS — exatamente os bytes que o GoTrue leu como "first record does not look like a TLS handshake". O `openssl` funcionou nas tentativas isoladas porque pegou a janela em que havia slot livre, mas em produção o Auth cai no 421.

A porta **587 com STARTTLS funcionou limpa** e o certificado é o mesmo. Solução: trocar para 587 + STARTTLS.

## Correção (copia e cola na VPS)

```bash
cd ~/supabase/docker

cp .env .env.bak-smtp-$(date +%s)

# Troca porta 465 -> 587 e garante STARTTLS
sed -i 's/^SMTP_PORT=465$/SMTP_PORT=587/' .env

# Se já existir SMTP_SECURE no .env, força false; senão, adiciona logo após SMTP_PORT
if grep -q '^SMTP_SECURE=' .env; then
  sed -i 's/^SMTP_SECURE=.*/SMTP_SECURE=false/' .env
else
  sed -i '/^SMTP_PORT=/a SMTP_SECURE=false' .env
fi

echo "=== confere ==="
grep -E "^(SMTP_HOST|SMTP_PORT|SMTP_USER|SMTP_ADMIN_EMAIL|SMTP_SENDER_NAME|SMTP_SECURE)=" .env

docker compose up -d --force-recreate auth

echo "=== espera subir ==="
for i in $(seq 1 20); do
  docker exec supabase-auth sh -lc 'pgrep -f auth >/dev/null' 2>/dev/null && break
  sleep 1
done

echo "=== confirma no container ==="
docker exec supabase-auth sh -lc 'env | grep -E "GOTRUE_SMTP_(HOST|PORT|USER|ADMIN_EMAIL|SENDER_NAME|SECURE)"'
```

Depois pede reset de senha de novo e roda:

```bash
docker logs supabase-auth --since 2m 2>&1 \
  | grep -iE "recover|smtp|tls|x509|refused|timeout|421|status\":5" | tail -30
```

Resultados possíveis:

- **Email chega** → resolvido. Salvo na memória que SMTP do Saturno é 587/STARTTLS e a porta 465 deles tem rate-limit que quebra TLS implícito.
- **Aparece 421 ainda na 587** → o limite é por conta SMTP, não por porta. Aí a saída é abrir ticket no Saturno pedindo aumento de limite simultâneo OU mudar pra outro provedor SMTP (SendGrid/Mailgun/Resend).
- **Aparece outro erro** (auth 535, 530, etc.) → me cola que eu resolvo no mesmo formato.