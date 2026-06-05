## Objetivo
1. Auditar se novos `push_subscriptions` estão chegando ao banco self-hosted (descobrir se o problema é **inscrição** ou **envio**).
2. Resolver de vez o push: garantir que cada device re-subscreva no novo SW v3 / nova VAPID e que o `send-push` consiga entregar.

---

## Parte 1 — Comandos de auditoria (rodar no Studio self-hosted SQL Editor de api.influlab.pro)

```sql
-- a) Quantas subscriptions existem hoje e quando foram criadas
SELECT date_trunc('day', created_at) AS dia, count(*) 
FROM push_subscriptions
GROUP BY 1 ORDER BY 1 DESC LIMIT 14;

-- b) Últimas 20 subscriptions (ver se há novas após o deploy do SW v3)
SELECT id, user_id, left(endpoint, 60) AS endpoint_preview, created_at
FROM push_subscriptions
ORDER BY created_at DESC
LIMIT 20;

-- c) Subscriptions por user específico (troca o email)
SELECT ps.* 
FROM push_subscriptions ps
JOIN auth.users u ON u.id = ps.user_id
WHERE u.email = 'SEU_EMAIL_AQUI'
ORDER BY ps.created_at DESC;

-- d) Users que TÊM perfil mas NÃO têm push_subscription (potenciais bloqueados)
SELECT count(*) FROM user_profiles up
WHERE NOT EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = up.user_id);
```

Interpretação:
- Se (b) mostra `created_at` recente → inscrição funciona, problema é no `send-push` (VAPID mismatch, endpoint inválido, etc.).
- Se (b) só mostra subscriptions antigas → o frontend não está re-subscrevendo. Precisa forçar.

---

## Parte 2 — Diagnóstico do `send-push` (descobre se o envio falha)

No VPS:
```bash
# Pega user_id real de um teste
docker exec -it supabase-db psql -U postgres -d postgres -c \
  "SELECT user_id FROM push_subscriptions ORDER BY created_at DESC LIMIT 1;"

# Dispara push manual (substitui UUID)
curl -sS -X POST "https://api.influlab.pro/functions/v1/send-push" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY ~/supabase/docker/.env | cut -d= -f2)" \
  -d '{"user_id":"<UUID_REAL>","title":"Vyral Lab","body":"Teste 🚀","url":"/"}'

# Ver logs da function
docker logs supabase-edge-functions --tail 100 | grep -i push
```

Códigos esperados de resposta do push provider (logados pela function):
- `201` → entregue ✅
- `404`/`410` → endpoint morto, deletar do banco
- `403` → VAPID errada (chave pública do front ≠ chave privada da function)

---

## Parte 3 — Passo a passo para resolver de vez

### 3.1 Confirmar VAPID alinhada
Verificar que a chave pública embutida no `usePushNotifications.ts` (`VAPID_PUBLIC_KEY`) bate com `VAPID_PUBLIC_KEY` que a edge function `send-push` recebe via env. Se divergente → todo push retorna 403.

Comando VPS:
```bash
grep VAPID ~/supabase/docker/.env
grep -n "VAPID_PUBLIC_KEY" src/hooks/usePushNotifications.ts
```
Comparar visualmente.

### 3.2 Forçar re-subscription de todos os devices
SW v3 já tem `unsubscribe()` no `activate`, ótimo. Mas o device só atualiza o SW quando:
- usuário fecha TODAS as abas do PWA, ou
- bumpamos algo no SW pra invalidar cache do browser.

Como `CACHE_NAME` já é `v3`, basta garantir que o `usePushNotifications.ts`:
- chama `registration.update()` no mount
- detecta `pushManager.getSubscription() == null` e re-subscreve automaticamente
- faz upsert por `endpoint` (não duplicar)

Vou revisar `usePushNotifications.ts` e ajustar o que faltar.

### 3.3 Limpar endpoints mortos no banco
SQL (preview-only, depois rodar como DELETE no Studio):
```sql
-- Listar endpoints antigos (>30 dias sem uso) — provavelmente mortos
SELECT id, user_id, left(endpoint,60), created_at 
FROM push_subscriptions 
WHERE created_at < now() - interval '30 days';
```
Depois `send-push` deve, ao receber 404/410 do provider, deletar a row automaticamente (verificar se faz isso).

### 3.4 Validar branding
Confirmar que `data.title || 'Vyral Lab'` aparece nos pushes. SW já está com "Vyral Lab". ✅

---

## Parte 4 — Ordem de execução recomendada

1. Rodar Parte 1 (a) e (b) → me mandar resultado.
2. Se há subs novas → vamos pra Parte 2 (testar send-push e ver erro).
3. Se não há subs novas → vou revisar `usePushNotifications.ts` e o fluxo de auto-resubscribe.
4. Comparar VAPID (3.1).
5. Após corrigir, limpar endpoints mortos (3.3).

---

## Detalhes técnicos
- Tabela usada: `public.push_subscriptions` (RLS: user vê só os seus; service_role full).
- Edge function de envio: `send-push` (recebe `{user_id, title, body, url}`).
- Cron de envio em massa: `scheduled-push`.
- SW: `public/sw-push.js` v3 (já força unsubscribe stale no activate).
- VAPID pública: embutida em `src/hooks/usePushNotifications.ts`.
- VAPID privada: env var `VAPID_PRIVATE_KEY` no container `functions`.

Nenhuma migration ou alteração de schema prevista nesta fase — só leitura + diagnóstico. Mudanças em código só se a Parte 3.2 revelar bug no hook.