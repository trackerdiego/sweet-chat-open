## Diagnóstico provável

A cliente não está presa no paywall global de login. O gatilho mais provável é o `CheckoutModal` mantendo um estado antigo no `sessionStorage` (`checkout:v1`) em etapa `result` e/ou sendo reaberto por `AutoCheckoutOpener`/`PaywallScreen` quando o app ainda não sincronizou a assinatura após o onboarding.

Hoje, depois que a matriz termina, o onboarding faz `window.location.replace('/')`. Na nova carga, se algum estado antigo de checkout ainda existir ou se `useSubscription` ainda não tiver confirmado `active`, o modal pode reaparecer mesmo com banco correto.

## Plano de correção

1. **Criar uma limpeza central de checkout pendente**
   - Remover do `sessionStorage`:
     - `pending_checkout_plan`
     - `checkout:v1`
   - Usar essa limpeza quando o usuário já tem assinatura ativa ou concluiu onboarding.

2. **Corrigir `CheckoutModal` para nunca ficar aberto para usuário ativo**
   - Se `isActive === true`, fechar o modal imediatamente.
   - Limpar draft antigo de pagamento.
   - Evitar que um PIX antigo salvo em `sessionStorage` reapareça depois do onboarding.

3. **Corrigir `AutoCheckoutOpener`**
   - Não abrir checkout automático se `useSubscription().isActive` já for verdadeiro.
   - Se estiver ativo, limpar `pending_checkout_plan` e `checkout:v1`.

4. **Blindar o final do onboarding**
   - Antes de redirecionar para `/`, limpar qualquer estado local de checkout pendente.
   - Após `refreshProfile()` confirmar `onboarding_completed=true`, aguardar/forçar um `refresh()` da assinatura antes de navegar.
   - Isso reduz corrida entre “matriz terminou” e “front ainda acha que precisa pagar”.

5. **Reduzir falso paywall para premium manual anual**
   - Em `useSubscription`, tratar `status='active'` como fonte absoluta de acesso, mesmo se `plan` ou `asaas_customer_id` vierem nulos.
   - Manter o bypass manual/admin existente.

6. **Entregar bloco VPS**
   - Como a memória do projeto exige, ao finalizar código vou incluir os comandos de pull/deploy para rodar na VPS.

## Arquivos previstos

- `src/components/CheckoutModal.tsx`
- `src/components/AutoCheckoutOpener.tsx`
- `src/pages/Onboarding.tsx`
- possivelmente `src/hooks/useCheckoutDraft.ts` ou novo util pequeno para centralizar a limpeza
- possivelmente `src/hooks/useSubscription.ts`, apenas se necessário para reforçar o caso premium manual

## Resultado esperado

Depois que a cliente concluir o onboarding e a matriz for gerada, ela entra direto no app. Nenhum modal de pagamento antigo deve abrir para usuário com `subscription_state.status='active'`, inclusive premium anual setado manualmente.