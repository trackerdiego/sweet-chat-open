## Testar se o keep-alive está funcionando

Três checagens independentes — rode em ordem, qualquer uma já confirma se está vivo.

### 1. VPS — confirmar que o cron existe e está agendado

```bash
crontab -l | grep keep-alive
```

Esperado: a linha `0 0 */5 * * curl ... /functions/v1/keep-alive ...`. Se não aparecer, o cron sumiu.

### 2. VPS — disparar o ping AGORA (não esperar 5 dias)

```bash
curl -i "https://gchncrlrmsyzumgmbplh.supabase.co/functions/v1/keep-alive" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjaG5jcmxybXN5enVtZ21icGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjQ1NDksImV4cCI6MjA5MDQwMDU0OX0.oAXmnjsdcnNPEBq76s2236_J_fKFNtjUnrQFX8JeQ_I"
```

Esperado: `HTTP/2 200` + `{"ok":true,"ts":"..."}`. Se vier 503/504, o Supabase Cloud já está pausado/lento (raro, mas é o sinal pra rodar manualmente e ajustar a frequência do cron).

### 3. VPS — provar que o cron disparou de verdade (não só manualmente)

```bash
grep CRON /var/log/syslog | grep keep-alive | tail -20
```

Em distros sem syslog (Ubuntu 22+ comum): 

```bash
journalctl -u cron --since "30 days ago" | grep keep-alive | tail -20
```

Esperado: ver execuções nos dias 5, 10, 15... do mês. Sem linhas = cron daemon não está rodando (`systemctl status cron`).

### 4. (opcional) Cloud — ver hits chegando pelo lado do Supabase

No dashboard Supabase Cloud → Edge Functions → `keep-alive` → Logs. Deve ter invocações nos mesmos dias do passo 3. Se eu consigo chamar pelo curl mas o cron não aparece nos logs, é problema do cron local — não do endpoint.

### Veredito

- Passos 1 + 2 OK → endpoint vivo, configuração presente.
- Passo 3 com pelo menos 1 entrada nos últimos 6 dias → estratégia 100% funcional.
- Passo 3 vazio → cron daemon parado ou crontab perdido após reboot; me avisa que ajusto.
