## Objetivo

Permitir que você (admin/equipe) visualize o card de bônus dourado com contagem regressiva exatamente como um usuário pagante veria nos primeiros 7 dias — sem perder seu bypass premium nas outras telas.

## Abordagem

Adicionar um **toggle de preview** acoplado ao próprio `GiftUnlockCard`, visível só para o email `agentevendeagente@gmail.com`. Quando ligado, força o card a renderizar simulando "primeiro pagamento foi há X horas", em vez de pular direto pro `HypeOfTheDay`.

Sem mexer em banco, sem afetar usuários reais, sem deploy de edge function.

## Mudanças

### `src/components/GiftUnlockCard.tsx`

1. Importar `useAuth` (ou `supabase.auth.getUser`) e detectar se o email logado é `agentevendeagente@gmail.com`.
2. Ler um flag de localStorage `vyrallab.previewGiftCard` (valores: `null` = off, ou ISO date string = "fingir que pagou nesta data").
3. Se admin **e** flag setada, usar essa data como `firstPaidAt` simulado e renderizar o `GiftCard` com a contagem real.
4. Adicionar um pequeno painel flutuante (só visível pro admin) com 4 botões:
   - **Desativar preview** (limpa o flag, volta ao `HypeOfTheDay`)
   - **7 dias restantes** (firstPaidAt = agora)
   - **3 dias restantes** (firstPaidAt = agora − 4d)
   - **< 1 dia** (firstPaidAt = agora − 7d 18h)
5. Painel discreto: chip fixo no canto, com label "👁 Preview admin" — não polui a UI real, e qualquer não-admin nem vê.

### Não mexer em

- Lógica de `useSubscription` / `firstPaidAt` real
- Bypass `isManualPremium` para qualquer outro user
- Banco, edge functions, RLS

## Resultado

Você abre o painel, clica "3 dias restantes", e o card dourado pulsante aparece no lugar do `HypeOfTheDay` com `3d 0h 0m` contando. Desativa quando quiser e volta ao normal.

## Pergunta

Confirma a abordagem? Posso implementar agora — leva 1 edit no `GiftUnlockCard.tsx`.
