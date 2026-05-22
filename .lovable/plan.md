
## Objetivo

Eliminar a tela "Quase lá! → Ir para pagamento" (redirect externo Asaas) e voltar para um checkout **100% interno** no `CheckoutModal`, com PIX (QR + copia-e-cola) e Cartão de Crédito (formulário inline) em abas. Junto disso, repaginar o visual do modal com a paleta violeta/glass do novo layout para dar vida.

## Mudanças

### 1. Backend — `supabase/functions/create-asaas-subscription/index.ts`

Hoje a função cria `subscription` com `billingType: "UNDEFINED"` e devolve `paymentUrl` (página hospedada Asaas). Vamos mudar para:

- Receber `paymentMethod: "PIX" | "CREDIT_CARD"` e, se cartão, `creditCard` + `creditCardHolderInfo`.
- Criar `subscription` com o `billingType` correto (`PIX` ou `CREDIT_CARD`).
  - Cartão: enviar `creditCard` + `creditCardHolderInfo` + `remoteIp` no body da subscription para tokenizar e cobrar na hora.
- Buscar a primeira cobrança gerada (`GET /subscriptions/{id}/payments`) e, se PIX, pegar o QR (`GET /payments/{id}/pixQrCode`).
- Resposta:
  - PIX → `{ subscriptionId, paymentId, pix: { encodedImage, payload, expirationDate } }`
  - Cartão → `{ subscriptionId, paymentId, status: "CONFIRMED" | "RECEIVED" | ... }` (sem URL externa)
- Espelhar `subscription_state` igual hoje (status só vira `active` via webhook, que já está pronto).

Erros do Asaas (cartão recusado, CPF inválido etc.) voltam com `error` legível.

### 2. Frontend — `src/components/CheckoutModal.tsx` (reescrito)

Estrutura em **3 etapas internas**, sem nunca sair do modal:

```text
Etapa A: Plano + dados (igual hoje, melhorado visual)
Etapa B: Escolher método [Tabs: PIX | Cartão]
         - PIX:    botão "Gerar PIX"
         - Cartão: form número/validade/CVV/nome → botão "Pagar R$X"
Etapa C: Resultado
         - PIX:    QR + copia-e-cola + "Aguardando pagamento…" (polling subscription)
         - Cartão: ✅ "Pagamento aprovado, liberando acesso…" (polling subscription)
```

Polling: usar `useSubscription` que já existe — quando `isActive` virar true, o `App.tsx` automaticamente sai do `PaywallScreen` e entra no onboarding. Sem precisar de lógica nova de redirect.

### 3. Visual — paleta do novo layout (violeta + glass)

Aplicar nos campos e botões do modal o mesmo idioma da `PaywallScreen` (já usa `glass-card`, `gold-gradient`, `text-primary`):

- Background do `DialogContent`: `glass-card` + leve gradient violeta no header.
- Cards de plano (Mensal/Anual): borda animada `border-primary` com `shadow-[0_0_24px_-4px_hsl(var(--primary)/0.4)]` quando selecionado, badge "Economize 47%" em `gold-gradient`.
- Tabs PIX/Cartão: pill com `bg-primary/10` ativo, ícone (QrCode / CreditCard).
- Inputs: `bg-background/50 backdrop-blur border-border/60 focus:border-primary` + `transition`.
- Botão principal: `gold-gradient` com `Crown` icon, hover scale sutil (`hover:scale-[1.01]`).
- Estado PIX: QR num card `bg-white p-4 rounded-2xl` centralizado, copia-e-cola com botão `Copy` que dá toast.
- Microanimação por etapa com `motion.div` (fade + slide 8px) para sensação de fluidez.

Tokens: tudo via `hsl(var(--primary))`, `hsl(var(--card))`, `gold-gradient` — zero cor hardcoded.

### 4. Remover `PaywallScreen` → abertura direta do modal

`PaywallScreen` continua existindo como gate (com os 5 bullets + CTA), mas:

- Mantém abertura automática do `CheckoutModal` igual hoje.
- Quando o pagamento for confirmado (cartão) ou detectado por polling (PIX), `useSubscription` muda para `active` e o gate cai sozinho — sem reload, sem redirect externo.

### 5. Arquivos tocados

- `supabase/functions/create-asaas-subscription/index.ts` — adiciona PIX/Cartão inline.
- `src/components/CheckoutModal.tsx` — reescrita com etapas + novo visual.
- `src/components/PaywallScreen.tsx` — ajustes mínimos (texto do CTA, nada estrutural).
- (Opcional) `src/hooks/useSubscription.ts` — diminuir intervalo de refetch para 5s enquanto o modal estiver no estado "aguardando PIX".

### 6. Self-hosted (SQL/Deploy)

- Nenhuma migration de banco necessária — `subscription_state` já tem as colunas usadas.
- Edge function precisa redeploy via `./scripts/deploy-selfhost.sh create-asaas-subscription` na VPS — eu mando o bloco copia-e-cola no final.
- Secret `ASAAS_API_KEY` já está configurado no container `functions`.

## Riscos / Observações

- **Tokenização de cartão**: o Asaas aceita os dados do cartão direto no POST da subscription (sem precisar de SDK JS). Isso é PCI-compliant pelo lado deles, mas o cartão passa pela nossa edge function por TLS — é o padrão suportado pela API REST do Asaas.
- **PIX polling**: webhook Asaas já trata `PAYMENT_RECEIVED` e marca `active`. O frontend só observa `useSubscription` mudar.
- **Cartão recusado**: mostrar erro inline no modal sem fechar nem perder os dados preenchidos.
