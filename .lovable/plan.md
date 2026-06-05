# Push notifications voltarem a funcionar — diagnóstico + correção

## Estado atual (lendo código + último log que você colou)

- `scheduled-push` rodou: `Block: evening · Sent: 0 · Skipped(dedup): 3`
- `send-push` está estruturalmente correto (VAPID + aes128gcm + JWT ES256)
- VAPID pub key bate entre frontend (`usePushNotifications.ts`), backend (`send-push/index.ts`) e SW
- 2 subscriptions Apple ativas no banco (`web.push.apple.com/…`), criadas em 20/04 e 26/04
- SW no repo já é `vyrallab-v2`

O sintoma é **`sent: 0` em todas as tentativas, e dedup pulando os mesmos users**. O código abaixo é o que precisa ser confirmado/destravado.

---

## Etapa 1 — Diagnóstico (não muda nada, só lê)

Você roda **3 blocos** na VPS e me cola o output. Sem isso, qualquer correção é chute.

### 1.1 — O que a Apple está respondendo HOJE
```bash
# Pega o endpoint completo de 1 subscription
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT user_id, endpoint, created_at FROM push_subscriptions ORDER BY created_at DESC;"

# Chama send-push direto pra esse user_id e olha a resposta
curl -sS -X POST "https://api.influlab.pro/functions/v1/send-push" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY ~/supabase/docker/.env | cut -d= -f2)" \
  -d '{"user_id":"COLAR_USER_ID_AQUI","title":"Teste manual","body":"Voltei!","url":"/"}'

# E olha os logs REAIS dessa execução (status code que veio da Apple)
docker logs $(docker ps -qf "name=supabase-edge-functions") 2>&1 | grep send-push | tail -30
```

### 1.2 — Estado real do dedup
```bash
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT send_date, block, COUNT(*) FROM push_send_log
   WHERE send_date >= CURRENT_DATE - 7 GROUP BY 1,2 ORDER BY 1 DESC, 2;"
```

### 1.3 — Cron está realmente disparando
```bash
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT runid, jobid, start_time, end_time, status, return_message
   FROM cron.job_run_details
   WHERE start_time > NOW() - INTERVAL '6 hours'
   ORDER BY start_time DESC LIMIT 20;"
```

Esses 3 outputs me dizem exatamente em qual dos cenários abaixo estamos.

---

## Etapa 2 — Correção, por cenário

Cada cenário tem fix isolado. Não aplico nada antes da Etapa 1 voltar.

### Cenário A — Apple devolve `403 BadJwt`/`InvalidVapidKey`
**Causa:** subscriptions foram criadas com uma VAPID antiga que não casa mais com a atual.
**Fix:** invalidar TUDO em `push_subscriptions` e mostrar o botão "Ativar notificações" pra todo mundo de novo.
```sql
TRUNCATE push_send_log;
TRUNCATE push_subscriptions;
```
Mais: no `usePushNotifications.ts` adicionar comparação de `applicationServerKey` no `useEffect` — se o `subscription.options.applicationServerKey` do device for diferente da `VAPID_PUBLIC_KEY` atual, força `unsubscribe()` + `setIsSubscribed(false)` automaticamente. Isso evita que aconteça de novo na próxima rotação.

### Cenário B — Apple devolve `410 Gone` mas `send-push` deleta corretamente
**Causa:** subscriptions caducaram e foram limpas. `push_send_log` ficou populado por execuções antigas que entregaram quando tudo funcionava.
**Fix:**
```sql
DELETE FROM push_send_log WHERE send_date >= CURRENT_DATE;
```
Pedir aos 2 users que reativem push no app. Se o frontend já mostra o `PushNotificationButton`, basta abrir.

### Cenário C — `send-push` retorna `sent: 1` no curl manual da 1.1, mas device não recebe
**Causa:** SW velho (v1) ainda no device — `push` event nem dispara ou dispara silencioso.
**Fix:**
- Bump `CACHE_NAME` pra `vyrallab-v3` no `public/sw-push.js`
- Adicionar `self.skipWaiting()` + `clients.claim()` (já estão lá ✓)
- No `usePushNotifications.ts`, registrar `navigator.serviceWorker.register('/sw-push.js', { updateViaCache: 'none' })` e chamar `reg.update()` no mount pra forçar refresh.

### Cenário D — Cron parou de rodar
A query 1.3 vai mostrar gap nas execuções.
**Fix:** reagendar `cron.schedule` com a URL self-hosted + anon key correta (SQL que você roda no Studio).

### Cenário E — Tudo funciona no curl, dedup vazio, mas cron diz `Sent: 0`
**Causa:** o `scheduled-push` chama `send-push` por HTTP usando `${supabaseUrl}/functions/v1/send-push` com SERVICE_ROLE como Bearer — pode estar batendo no Kong sem auth válida.
**Fix:** trocar a chamada HTTP por invocação interna com `supabase.functions.invoke('send-push', { body })` usando o client já criado, OU adicionar header `apikey` além de `Authorization`.

---

## Não toco em (deixar como está)

- VAPID keys atuais — funcionam, problema não é geração.
- Lógica de segmentação/mensagens — irrelevante pra entrega.
- Frontend de UI do botão — só ajustar registro do SW se cenário C.

---

## Entregável final

Depois da Etapa 1, te mando **só o fix do cenário correto** + bloco copia-e-cola pra VPS (deploy `send-push` + `scheduled-push` se preciso, e/ou SQL no Studio). Sem chutar.
