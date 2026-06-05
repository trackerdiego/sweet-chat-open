# Por que push parou de chegar

O backend está 100% saudável: `send-push` loga `✓ delivered` (Apple/FCM retornam 200/201). Mas no device, nada aparece.

**Causa:** as 3 subscriptions no banco foram criadas em abril, quando o app era "Influ Lab" e o SW era `v1`. Depois o repo subiu o SW `vyrallab-v2` e o nome "Vyral Lab", mas:

1. Apple/FCM continuam aceitando o endpoint antigo por inércia (por isso o log diz "delivered") — só vão devolver `410 Gone` depois de muitos dias de falha.
2. No device, o SW novo (`v2`) ativou e fez `clients.claim()`, mas a `pushManager.subscription` antiga continua "viva" apontando pra um keypair que o SW velho conhecia. O `push` event chega no SW novo, mas a decifragem/handler nem sempre casa, e em alguns devices o SW v2 nem registrou a mesma sub.
3. O frontend só re-subscreve se o usuário clicar o botão de novo — ninguém faz isso.

Resultado: scheduled-push manda → Apple aceita → device não mostra nada.

## Fix (frontend only — sem mexer em backend nem banco)

### 1. `public/sw-push.js`
- Bump `CACHE_NAME` de `vyrallab-v2` → `vyrallab-v3` (força reinstall em todo device).
- No `activate`, depois de limpar caches antigos, chamar `self.registration.pushManager.getSubscription()` e dar `unsubscribe()` nela. Isso obriga o device a pedir uma sub nova na próxima visita.
- Garantir fallback do `data.title` como `'Vyral Lab'` (já está, manter).

### 2. `src/hooks/usePushNotifications.ts`
- No `useEffect` inicial, depois de `navigator.serviceWorker.ready`, chamar `reg.update()` pra forçar checagem de SW novo a cada visita.
- Adicionar lógica: se `reg.pushManager.getSubscription()` retornar `null` MAS já existir registro no banco pra esse `user_id` (ou seja, user já tinha permitido push antes) → re-subscrever silenciosamente e fazer upsert. Sem clique, sem prompt, sem toast.
  - Permission já está `granted` → `pushManager.subscribe` não pede nada de novo.
  - O `upsert` com `onConflict: 'endpoint'` já cobre duplicatas.
- Se permission for `denied` ou `default`, NÃO faz nada (não tem como re-subscrever sem clique).

### 3. SQL pro user rodar no Studio self-hosted (limpa zumbis)
Depois do deploy frontend, as subs antigas vão ficar órfãs. Limpar:
```sql
TRUNCATE push_send_log;
TRUNCATE push_subscriptions;
```
Aí no próximo carregamento do app em cada device, o passo 2 re-cria a sub limpa com VAPID atual + SW v3.

## O que NÃO toco

- `send-push`, `scheduled-push` — funcionam.
- VAPID keys — funcionam.
- Backend, cron, banco — funcionam.
- Manifest — já está "Vyral Lab".

## Entrega final (depois de aprovar)

- Edits nos 2 arquivos frontend.
- Bloco copia-e-cola pra VPS: só o SQL acima no Studio + esperar Vercel auto-deployar frontend do GitHub. Sem rebuild de edge function.

## Validação

Depois do deploy, abrir o app em 1 device (com push já permitido antes), esperar ~10s, e rodar:
```bash
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT user_id, created_at FROM push_subscriptions ORDER BY created_at DESC LIMIT 5;"
```
Deve aparecer sub nova com `created_at` de agora. Aí dispara `curl` manual no `send-push` com esse user_id e o device DEVE mostrar a notificação "Vyral Lab".
