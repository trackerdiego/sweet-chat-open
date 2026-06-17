
# Parcelamento do Plano Anual (até 12x)

## Resumo
Adicionar opção de parcelar o plano anual (R$297) em 1x a 12x no cartão, com o usuário escolhendo a quantidade de parcelas no checkout. Suporte preparado para juros caso a Asaas cobre taxa extra por parcela.

## Como a Asaas trata parcelamento (contexto técnico)

A API da Asaas separa dois fluxos:
- **`/subscriptions`** (assinaturas recorrentes): NÃO aceita `installmentCount`. Cada ciclo gera uma cobrança única.
- **`/payments`** (cobrança avulsa): aceita `installmentCount` + `totalValue`, dividindo no cartão.

Como o plano anual hoje usa subscription com `cycle=YEARLY`, a primeira cobrança sai 1x. Para parcelar, a abordagem padrão é:

1. **Primeiro ano: cobrança parcelada** via `/payments` com `creditCard` + `installmentCount=N` + `totalValue=297`.
2. **Renovação:** criar uma `/subscriptions` com `nextDueDate = hoje + 365 dias`, `cycle=YEARLY`, `value=297`, usando o mesmo cartão tokenizado retornado pela Asaas. Assim a próxima cobrança (daqui 1 ano) sai automática.

Sobre juros: a Asaas cobra uma **taxa adicional por parcela** do recebedor (configurada na conta Asaas, normalmente ~2,49% a.m. para parcelado lojista). Essa taxa **não é repassada automaticamente** ao comprador — quem decide é o lojista. Vou implementar com uma **tabela de juros configurável no código** (default = sem juros, absorvido pelo lojista). Se você quiser repassar, é só ajustar a tabela ou setar via secret.

## Mudanças

### Backend — `supabase/functions/create-asaas-subscription/index.ts`
- Aceitar novo campo `installmentCount` (1-12) no body. Default 1.
- Quando `plan=yearly` + `billingType=CREDIT_CARD` + `installmentCount>1`:
  - Calcular `totalValue` com base na tabela de juros (ver abaixo).
  - Chamar `POST /payments` (não `/subscriptions`) com `installmentCount`, `totalValue`, `creditCard`, `creditCardHolderInfo`, `remoteIp`, `dueDate`, `description`.
  - Após sucesso, criar `/subscriptions` com `nextDueDate = +365d`, `cycle=YEARLY`, `value=297`, `creditCardToken` (retornado pela cobrança parcelada) — para a renovação 1 ano depois.
  - Espelhar em `subscription_state` (plan=`annual`, `asaas_subscription_id`, `asaas_customer_id`).
- Quando `installmentCount=1` ou PIX ou mensal: comportamento atual permanece intacto.
- Resposta inclui `installmentCount`, `installmentValue`, `totalValue`, `interestApplied` para o frontend exibir confirmação.

### Tabela de juros (constante no arquivo)
```ts
// % de acréscimo TOTAL sobre R$297 por número de parcelas.
// Default: sem juros (lojista absorve). Editar aqui se quiser repassar.
const INTEREST_TABLE: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
  7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
};
```
Documentar em comentário a fórmula caso queira ativar (ex: Price com taxa Asaas 2,49% a.m.).

### Frontend — checkout do plano anual (provavelmente `src/pages/Checkout.tsx` ou similar; vou localizar e confirmar)
- Quando plano = anual e método = cartão: exibir `<Select>` com 1x até 12x.
- Mostrar para cada opção: `Nx de R$ XX,XX (sem juros)` ou `(total R$ YYY,YY)` se houver juros.
- Calcular valores no client a partir da mesma tabela (espelhada) ou buscar de endpoint helper (decido pela tabela espelhada — mais simples, sem round-trip).
- Enviar `installmentCount` no body do `create-asaas-subscription`.
- Tela de confirmação mostra "Nx de R$ XX,XX no cartão".

### Sem mudanças
- Plano mensal, PIX, webhook, schema do banco, fluxo de coins/desconto.

## Verificação
- Anual + cartão + 1x → fluxo atual idêntico (subscription YEARLY direto).
- Anual + cartão + 6x → cria payment parcelado 6x de R$49,50 + subscription com renovação em +365d.
- Anual + PIX → continua 1x R$297 (PIX não parcela).
- Mensal → inalterado.
- Webhook `PAYMENT_RECEIVED` continua marcando premium na primeira parcela paga (comportamento atual da Asaas para parcelados é confirmar acesso no primeiro pagamento — vou confirmar com log no webhook após deploy).

## Pergunta única antes de implementar
**Default da tabela de juros:** começo com **sem juros até 12x** (lojista absorve a taxa Asaas)? Posso deixar a tabela pronta e comentada para você ativar juros depois com 1 linha. Confirma?
