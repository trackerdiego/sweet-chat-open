## Diagnóstico

O app está mandando o usuário recém-criado para `/onboarding` porque `App.tsx` prioriza `needsOnboarding` antes de checar pagamento:

```text
login/signup ok
→ perfil existe com onboarding_completed=false
→ AppRoutes entra no bloco needsOnboarding
→ redireciona qualquer rota para /onboarding
```

Além disso, `useSubscription` ainda considera `trial` como acesso válido (`hasAccess = active || trialing`). Como o banco self-hosted ainda cria `subscription_state.status='trial'` para novos usuários legados, isso permite acesso sem pagamento.

## Plano de correção

1. **Remover acesso por trial no frontend**
   - Em `useSubscription`, `hasAccess` passa a ser verdadeiro somente quando `status === 'active'`.
   - Manter `isTrialing` apenas como informação legada, sem liberar app.

2. **Colocar pagamento antes do onboarding**
   - Em `App.tsx`, para usuário autenticado sem assinatura ativa, renderizar uma tela/modal de checkout e impedir `/onboarding`.
   - Só liberar `/onboarding` depois que `useSubscription().isActive` for verdadeiro.

3. **Preservar o fluxo otimizado de conversão**
   - Landing → planos → criar conta → checkout interno Asaas.
   - Se o usuário fechar ou não clicar no link externo de pagamento, ele continua bloqueado no checkout/paywall, não vai para onboarding.
   - Após pagamento confirmado pelo webhook Asaas e assinatura ficar `active`, aí sim entra no onboarding.

4. **Remover mensagens públicas de trial/freemium**
   - Não mostrar `TrialBanner` para novos usuários sem assinatura ativa.
   - Ajustar textos do bloqueio para “finalizar pagamento” em vez de “período grátis”.

5. **Restaurar a força comercial do modal interno**
   - Reforçar o `CheckoutModal` com os bullet points/empilhamento de valor e bônus antes dos campos, mantendo checkout Asaas interno.
   - Sem checkout externo como primeira tela; o link externo só aparece depois que o Asaas gerar a cobrança.

## Observação importante

Como o backend é Supabase self-hosted, qualquer correção definitiva no banco/trigger de criação de usuário precisa ser entregue como SQL para você rodar no Studio self-hosted. A correção frontend impede a conversão quebrada agora; o SQL recomendado depois é parar de criar `trial` para novos usuários ou criar como `canceled/pending` sem acesso.