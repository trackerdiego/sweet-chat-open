
# Corrigir Sistema de Pagamentos Asaas

## Problemas Críticos

### 1. `getClaims()` inexistente — Edge function quebrada
A função `create-asaas-subscription` usa `supabase.auth.getClaims()` que não existe no SDK. Isso significa que **nenhuma assinatura consegue ser criada** — a função sempre retorna erro.

**Correção:** Trocar por `supabase.auth.getUser()` que retorna o user_id corretamente.

### 2. Eventos de webhook incompletos
Faltam eventos importantes:
- `PAYMENT_OVERDUE` / `PAYMENT_REFUNDED` — devem desativar premium
- `PAYMENT_CONFIRMED` no objeto `payment` pode não ter `externalReference` dependendo do fluxo

### 3. Webhook URL precisa ser configurada no painel Asaas
A URL do webhook é: `https://gchncrlrmsyzumgmbplh.supabase.co/functions/v1/asaas-webhook`
O usuário precisa cadastrar essa URL no painel do Asaas em Integrações > Webhooks.

## Arquivos a Alterar

### `supabase/functions/create-asaas-subscription/index.ts`
- Trocar `supabase.auth.getClaims(token)` por `supabase.auth.getUser()` 
- Extrair `userId` de `user.id` em vez de `claims.sub`

### `supabase/functions/asaas-webhook/index.ts`
- Adicionar eventos `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED` para desativar premium
- Melhorar log para facilitar debug

## Passo Manual (informar ao usuário)
- Configurar URL do webhook no painel Asaas: `https://gchncrlrmsyzumgmbplh.supabase.co/functions/v1/asaas-webhook`
- Selecionar eventos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_REFUNDED, SUBSCRIPTION_DELETED, SUBSCRIPTION_INACTIVE
