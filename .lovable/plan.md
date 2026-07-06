## Diagnóstico

A cliente NÃO está travada no `PaywallScreen` global (`App.tsx`) — o `useSubscription` está lendo `status='active'` corretamente, o app abre normal. O que acontece:

1. Antes de a gente ativar ela manualmente, ela chegou a gerar uma cobrança PIX no Asaas. Isso deixou `subscription_state.next_invoice` populado com um invoice PIX pendente (QR code, due_date, etc).
2. Ativamos ela manual (`status='active'`, `current_period_end` 1 ano à frente), mas ninguém limpou o `next_invoice` obsoleto.
3. Ao logar, o `PixDueBanner` (topo da tela, em `App.tsx` linha 92) lê esse `next_invoice` antigo, vê `daysUntilDue <= 3` (vencido/vencendo), pinta a barra vermelha "Sua fatura Pix vence hoje" e ao clicar joga em `/renovar`, que mostra o QR code do PIX. Pra cliente, é indistinguível de um paywall.

Isso vai afetar TODA cliente que a gente já ativou manual ou que vier a ser ativada manual no futuro (equipe, cortesias, correções de erro do webhook).

## Fix (só front-end, sem tocar em back)

Regra: um `next_invoice` só é considerado válido quando é **coerente com o período atual da assinatura**. Se `current_period_end` está muito à frente do `due_date` do invoice, o invoice é obsoleto (a assinatura já foi renovada/estendida por outro caminho) e deve ser ignorado.

### 1. `src/hooks/usePendingInvoice.ts`
- Passar a ler também `current_period_end` e `status` do `subscription_state` na query.
- Adicionar helper `isInvoiceStale(invoice, currentPeriodEnd)`: retorna `true` quando `currentPeriodEnd` existe e é maior que `invoice.due_date + 2 dias de folga` (folga cobre o intervalo normal de "gerou fatura do próximo ciclo antes do fim do atual").
- Quando `isInvoiceStale` for verdadeiro OU `status !== 'active' && status !== 'past_due'` for falso mas o invoice já venceu há mais de 7 dias sem virar `past_due`, tratar `invoice` como `null` no retorno (mantém dados brutos internos pra debug, mas expõe `invoice=null`, `hasPendingPixInvoice=false`, `hasUrgentInvoice=false`).

### 2. `src/pages/Renew.tsx`
- Nenhuma mudança de lógica além de já cair no branch "Nenhuma fatura pendente" quando o hook devolver `invoice=null`. Isso resolve o caso da cliente que digita `/renovar` na mão ou é redirecionada por link antigo.

### 3. Sem mudança em `PixDueBanner.tsx`
Ele já esconde sozinho quando `hasUrgentInvoice=false`.

## Fora de escopo (não vou mexer agora)

- Não vou mexer em `PaywallScreen`, `AccessGuard`, `useSubscription`, `App.tsx` — todos esses já estão corretos pro caso da manual annual.
- Não vou limpar `next_invoice` no banco via SQL agora; o fix no front resolve pra todas as clientes de uma vez sem depender de eu rodar UPDATE pra cada uma. Se quiser depois eu escrevo o SQL, mas não é bloqueante.

## Como valida

Depois do deploy, a cliente que estava travada:
- abre o app → não vê mais a barra vermelha do PIX no topo
- se clicar em algum link antigo pra `/renovar`, vê "Nenhuma fatura pendente · Sua assinatura está em dia · Voltar pro app"
