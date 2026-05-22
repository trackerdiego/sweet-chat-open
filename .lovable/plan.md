## Diagnóstico

Confirmei no banco: seu `subscription_state` está **`status='active'`, `plan='monthly'`, `is_premium=true`**. Ou seja, do lado dos dados você é premium de verdade.

O problema é no **hook `useSubscription`**, que tem 2 falhas combinadas:

### Falha 1 — query falha em silêncio
```ts
const { data } = await supabase.from('subscription_state').select(...).maybeSingle();
if (data) { setSub(...) }
setLoading(false);
```
Não trata `error`. Quando a auth lock é "roubada" (`Lock "lock:sb-api-auth-token" was released because another request stole it` — está aparecendo no seu console agora), o `getUser()` ou o select retorna sem `data`. O hook então:
- Mantém o `DEFAULT` (`status: 'trial'`, sem `trialEndsAt`)
- Marca `loading=false`
- `isActive` vira `false` → `App.tsx` cai em `<PaywallScreen />`

Toda vez que isso acontece (lock contention típica de React Strict Mode / múltiplos componentes consumindo `supabase.auth` ao mesmo tempo), você vê o paywall por 1-2 segundos até refetch.

### Falha 2 — sem fallback para admin
Mesmo se a query falhar, o admin master deveria ter bypass. Hoje não tem nenhum.

## Plano

### 1. `src/hooks/useSubscription.ts` — tornar resiliente
- Capturar `error` do `maybeSingle()`.
- Se houver erro **OU** se `data` for `null` mas a sessão for válida, **não** marcar `loading=false` na primeira tentativa: fazer 1 retry com backoff curto (500ms).
- Adicionar guard: enquanto não houve **nenhuma** resposta bem-sucedida (nem `data`, nem confirmação de "linha não existe"), manter `loading=true` em vez de assumir trial default. Isso evita flash de paywall em qualquer usuário, não só admin.
- Expor um estado `hasLoadedOnce` interno para diferenciar "ainda não sei" de "sei que não tem assinatura".

### 2. Bypass de admin
- Em `useSubscription`, depois de pegar o user, se `user.email === 'agentevendeagente@gmail.com'`, retornar `isActive=true`, `hasAccess=true`, `status='active'` direto, sem depender da tabela. Você nunca mais vê paywall na sua conta mesmo se a query falhar.
- (Alternativa mais limpa: tabela `admin_users` — mas como o admin é fixo e já tratado por email em outros lugares do app conforme a memória, manter por email é consistente.)

### 3. `src/App.tsx` — não cair em paywall enquanto sub estiver indefinida
Trocar:
```ts
if (!subLoading && !isActive) return <PaywallScreen />
```
por algo que só dispare quando temos certeza (`hasLoadedOnce && !isActive`). Combinado com #1, elimina o flash.

### 4. Mitigar a causa raiz do lock
O warning `Lock ... was released because another request stole it` vem de múltiplos `supabase.auth.getUser()` simultâneos (`useUserProfile`, `useSubscription`, `usePendingInvoice`, `AutoCheckoutOpener`, etc., todos chamando ao mesmo tempo no mount). Não vou refatorar todos agora — o fix #1+#3 já blinda contra o sintoma. Anoto como dívida técnica.

## Resultado esperado
- Você (admin) nunca mais vê paywall.
- Qualquer usuário premium real para de ver flash de paywall quando a auth lock briga.
- Comportamento para quem realmente não pagou: idêntico ao atual.