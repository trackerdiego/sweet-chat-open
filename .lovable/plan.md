
# Plano: validar parcelamento com cobrança real mínima

Objetivo: confirmar em produção que o fluxo de parcelamento do plano anual funciona ponta-a-ponta (Asaas + webhook + ativação premium + renovação agendada) sem arriscar uma cobrança alta.

## Etapas

### 1. Modo "teste de parcelamento" temporário
Adicionar uma flag de teste no `create-asaas-subscription` (edge function) que, quando o request vier com `__testMode: true` + header `x-test-secret` correto, força:
- `value: 5.00` (em vez de 297)
- `totalValue` recalculado conforme `installmentCount`
- Tudo o resto do fluxo idêntico ao real (mesma API key Asaas de produção, mesmo webhook, mesma ativação premium)

A flag não vaza pro usuário comum — só você consegue acionar via um botão escondido no checkout (visível apenas se seu email = `agentevendeagente@gmail.com`).

### 2. Botão "Testar parcelamento (R$5)" no CheckoutModal
Visível só pro admin. Ao clicar:
- Abre o mesmo fluxo de checkout anual em cartão
- Permite escolher 2x, 3x, 6x ou 12x
- Envia o `__testMode: true` pro backend
- Cobra R$5 parcelado de verdade no seu cartão

### 3. O que validar após a cobrança
- [ ] Asaas criou N parcelas corretas no painel (ex: 2x R$2,50)
- [ ] Webhook `PAYMENT_CONFIRMED` chegou e ativou premium
- [ ] Subscription de renovação foi criada com `nextDueDate = hoje + 365d`
- [ ] `subscription_state` no banco está correto
- [ ] Próximas parcelas aparecem agendadas no Asaas

### 4. Reverter
Depois que validar, remover:
- Flag `__testMode` da edge function
- Botão admin do CheckoutModal
- Deploy via `./scripts/deploy-selfhost.sh create-asaas-subscription`

Seu cartão será cobrado R$5 parcelado de verdade (em 2x de R$2,50 se escolher 2x, etc). Você pode estornar no Asaas depois, ou deixar como "custo de QA".

## Arquivos afetados

- `supabase/functions/create-asaas-subscription/index.ts` — adiciona modo teste com guard por header secret
- `src/components/CheckoutModal.tsx` — botão admin oculto + envio do flag
- (temporário) novo secret `TEST_MODE_SECRET` no self-hosted

## Pós-validação
Bloco copia-e-cola pra VPS revertendo a função ao estado limpo.

---

**Confirma esse caminho?** Se sim, eu também pergunto qual quantidade de parcelas você quer testar primeiro (sugiro 12x pra estressar o pior caso).
