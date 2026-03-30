

# Revisao Freemium e Pagamentos — Problemas Encontrados

## Problema Critico: Pagamento nao ativa o premium

O fluxo atual cria a assinatura no Asaas e gera o link de pagamento, mas **nao existe nenhum webhook** para receber a confirmacao de pagamento do Asaas. Ou seja: o usuario paga, mas `is_premium` nunca muda para `true` no banco. O premium simplesmente nao funciona.

Alem disso, a edge function `create-asaas-subscription` nao vincula o `user_id` do Supabase ao cliente/assinatura do Asaas — entao mesmo com webhook, nao saberia qual usuario ativar.

## Problema Secundario: Contadores de uso nunca resetam

- `script_generations` reseta por dia (correto)
- `tool_generations`, `transcriptions` e `chat_messages` acumulam para sempre — usuario free esgota o limite e nunca recupera

## Plano de Correcao

### 1. Vincular user_id na criacao da assinatura

**Arquivo:** `supabase/functions/create-asaas-subscription/index.ts`

- Extrair `user_id` do JWT do request (usuario autenticado)
- Passar `externalReference: user_id` no body da assinatura do Asaas
- Isso permite que o webhook identifique qual usuario pagou

### 2. Criar webhook do Asaas

**Novo arquivo:** `supabase/functions/asaas-webhook/index.ts`

- Receber eventos `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED` do Asaas
- Extrair `externalReference` (user_id) do pagamento
- Atualizar `user_usage.is_premium = true` usando service role
- Tratar cancelamento (`SUBSCRIPTION_DELETED`) para desativar premium
- Sem verificacao JWT (webhook externo), mas validar que o request vem do Asaas

### 3. Resetar contadores periodicamente

**Arquivo:** `src/hooks/useUserUsage.ts`

- Adicionar campo `last_usage_reset` na logica (ou usar abordagem por data como ja faz com scripts)
- Aplicar reset diario para `chat_messages` e mensal para `tool_generations` e `transcriptions`
- Alternativa mais simples: usar a mesma logica de `last_script_date` com campos `last_tool_date`, `last_chat_date`, etc.

**Migracao SQL:** Adicionar colunas `last_tool_date`, `last_transcription_date`, `last_chat_date` em `user_usage`

### 4. Pre-preencher email do usuario logado no checkout

**Arquivo:** `src/components/CheckoutModal.tsx`

- Buscar email do usuario autenticado e pre-preencher o campo de email

## Arquivos alterados

1. `supabase/functions/create-asaas-subscription/index.ts` — vincular user_id via externalReference
2. `supabase/functions/asaas-webhook/index.ts` — novo, receber confirmacao de pagamento
3. `supabase/migrations/<nova>.sql` — colunas de reset por data
4. `src/hooks/useUserUsage.ts` — logica de reset por data para todos os contadores
5. `src/components/CheckoutModal.tsx` — pre-preencher email

## Prioridade

O webhook e o vinculo do user_id sao **criticos** — sem eles, ninguem que pagar sera ativado como premium. Os resets de contadores e o pre-preenchimento sao melhorias importantes mas secundarias.

