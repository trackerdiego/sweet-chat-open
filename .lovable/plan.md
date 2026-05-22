## Objetivo

Travar a seção **Hype do dia** como bônus anti-chargeback. Antes do dia 8 (contado a partir do primeiro `PAYMENT_RECEIVED` confirmado), o usuário vê apenas um card dourado pulsante com ícone de presente 🎁 + cadeado e contagem regressiva — sem skeletons, sem prévia do conteúdo. Após o dia 8, a seção desbloqueia automaticamente.

## Diagnóstico

A infraestrutura **já existe** e está conectada:
- `src/components/GiftUnlockCard.tsx` — card dourado com `Gift` + `Lock` + sparkles + shimmer + contador `Xd Yh Zm`
- `src/pages/Index.tsx:204` — já renderiza `<GiftUnlockCard />` no lugar do `<HypeOfTheDay />`
- Lógica baseada em `firstPaidAt` do `useSubscription`, janela de 8 dias

O que está errado:
1. A copy do card fala "Trends Virais do YouTube com thumbnails" — herdado de outro projeto pausado, não bate com **Hype do dia**
2. O bypass `isManualPremium` (equipe sem `asaas_customer_id`) renderiza direto o `HypeOfTheDay` — por isso o admin vê o skeleton "Vasculhando tendências do Brasil pra você…" da imagem enviada, em vez do card de presente

## Mudanças

### 1. `src/components/GiftUnlockCard.tsx` — recopy

Trocar o texto do `small` em todos os 3 chamados de `GiftCard`:
- De: `"Trends Virais do YouTube com thumbnails"`
- Para: `"Hype do dia — tendências virais do Brasil"`

Reforçar a promessa do bônus nos títulos/subtítulos:
- Estado **sem firstPaidAt**: `title="Seu bônus tá chegando"`, `subtitle="Liberado após o primeiro pagamento confirmado"`, `bigText="Aguardando confirmação"`
- Estado **contagem**: `title="Bônus exclusivo desbloqueando"`, `subtitle="Liberado em X dias"`
- Estado **última hora**: `title="Liberando em instantes!"`, `subtitle="Atualize a página em algumas horas"`

### 2. Bypass de equipe permanece

Manter `isManualPremium` (equipe interna) com acesso direto ao `HypeOfTheDay`. **Mas** durante teste visual, você pode forçar o card aparecendo para sua conta de admin via um flag local — opcional, só se quiser revisar o visual ao vivo. Por padrão, equipe continua com bypass.

### 3. Não mexer em

- `HypeOfTheDay.tsx` continua intacto — só é montado pós-desbloqueio
- `Index.tsx` já chama `<GiftUnlockCard />` no lugar certo, nenhuma mudança
- Janela de 8 dias (`UNLOCK_DAYS = 8`) e fonte de verdade (`firstPaidAt` do webhook Asaas) permanecem

## Resultado visual

O usuário que acabou de pagar vê, no lugar dos 4 quadradinhos vazios da imagem:

```text
┌─────────────────────────────────┐
│  ✨  [🎁 com cadeado dourado]  ✨ │
│                                 │
│   Bônus exclusivo desbloqueando │
│      Liberado em 7 dias         │
│                                 │
│         6d 23h 12m              │ ← dourado, pulsante
│                                 │
│  HYPE DO DIA — TENDÊNCIAS       │
│       VIRAIS DO BRASIL          │
└─────────────────────────────────┘
```

Borda gradient dourada animada (shimmer 4s), ícone presente fazendo "bob" suave, sparkles decorativas, glow pulsante. Já está tudo implementado — só falta a copy bater com **Hype do dia**.

## Perguntas antes de implementar

1. Confirma o texto do bônus como **"Hype do dia — tendências virais do Brasil"**? Ou prefere outra frase (ex: "Hype do dia — as 10 tendências quentes do Brasil pro seu nicho")?
2. Quer que eu force o card aparecer para você (admin) também durante o período de teste, ou mantém o bypass da equipe?
