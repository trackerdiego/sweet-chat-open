## Diagnóstico

Toda infra já existe e funciona:
- Hook `usePendingInvoice` → lê `subscription_state.next_invoice` (QR, copia-e-cola, valor, vencimento, payment_url)
- Página `/renovar` (`Renew.tsx`) → renderiza QR, botão copiar, abrir no banco, trocar pra cartão
- Banner `PixDueBanner` → aparece no topo só quando faltam ≤3 dias
- `AccessGuard` → redireciona pra `/renovar` quando `past_due`/`canceled`

**Gap real:** premium **Pix em dia** (faltam mais de 3 dias) não tem ponto de entrada visível pra ver o QR e adiantar pagamento. Hoje só vê quando faltam ≤3 dias.

**Decidido:** assinantes via cartão **não enxergam nada** (Asaas cobra automático).

## Regra de exibição (única, em todo lugar)

Mostrar entrada de "Fatura Pix" se e somente se:
- `invoice` existe em `next_invoice`
- `invoice.is_paid === false`
- `invoice.billing_type === 'PIX' || invoice.billing_type === 'UNDEFINED'`
- (cartão = `'CREDIT_CARD'` → esconde tudo)

Vou expor isso como `hasPendingPixInvoice` no `usePendingInvoice` pra reusar limpo.

## Mudanças

### 1. `src/hooks/usePendingInvoice.ts`
Adicionar flag `hasPendingPixInvoice` (Pix pendente, mesmo sem urgência) ao lado do `hasUrgentInvoice` que já existe.

### 2. `src/pages/Carteira.tsx`
Adicionar card "Sua próxima fatura Pix" no topo da Carteira **só se `hasPendingPixInvoice`**:
- Valor + data de vencimento + chip de status (em dia / vence em X dias / vencida)
- Botão **"Ver QR Code Pix"** → navega pra `/renovar`
- Se for cartão → não renderiza nada

### 3. Menu/Profile
Adicionar item "Fatura Pix" → `/renovar` **só visível quando `hasPendingPixInvoice`**. Vou descobrir o componente exato (Profile/Settings/dropdown) na execução. Cartão recorrente não vê o item.

### 4. `src/pages/Renew.tsx`
Adicionar faixa sutil no topo só quando `daysUntilDue > 3 && isActive`:
> "Sua assinatura está ativa até DD/MM. Você pode adiantar o próximo pagamento abaixo."

Mantém todo o resto intacto.

### 5. `PixDueBanner.tsx`
Não muda. Continua só pra urgência (≤3 dias). Pix em dia tem entrada sutil (Carteira + menu), urgente continua banner gritante no topo.

## Arquivos afetados

- `src/hooks/usePendingInvoice.ts` (+1 flag exportada)
- `src/pages/Carteira.tsx` (card opcional no topo)
- `src/pages/Renew.tsx` (faixa "ainda em dia")
- Componente de menu/perfil a identificar (item "Fatura Pix")

## Não vou mexer em
- Edge functions (já blindadas)
- Banco / migrations
- `PixDueBanner` (urgência continua igual)
- Fluxo do AccessGuard
- Nada relacionado a cartão recorrente

## Bloco copia-e-cola pra VPS

Como mudanças são 100% frontend (Vercel auto-deploy do GitHub), entrego no fim:
```
# nada a rodar na VPS — Vercel pega do push automaticamente
```

Aguardo aprovação pra implementar.
