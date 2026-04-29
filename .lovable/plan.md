## Objetivo

Eliminar a palavra "Renovar" da experiência de quem paga via cartão (gatilho ruim de retenção) e oferecer um canal **discreto** de cancelamento via email **somente** para esse público.

Quem paga via Pix continua vendo tudo igual — pra esses, "renovar" é literalmente o que precisam fazer todo mês.

## Mapeamento de "Renovar" no app hoje

| Local | Texto/contexto | Quem vê | Decisão |
|---|---|---|---|
| `App.tsx` | rota `/renovar` | URL técnica | **manter** (só URL, ninguém lê) |
| `Renew.tsx` | título **"Renove sua assinatura"** | Pix pendente | **trocar pra "Sua fatura Pix"** (palavra "renovar" some) |
| `Navigation.tsx` | item dropdown "Fatura Pix" → `/renovar` | Pix pendente | **manter** (label já é "Fatura Pix", não "Renovar") |
| `PixDueBanner.tsx` | banner "Sua fatura Pix vence..." → `/renovar` | Pix urgente | **manter** (texto não usa "renovar") |
| `Wallet.tsx` | card "Próxima fatura Pix" → `/renovar` | Pix pendente | **manter** (label "Ver QR") |
| `AccessGuard.tsx` | botão **"Pagar fatura pendente"** → `/renovar` | Past due / canceled | **manter** (palavra "renovar" não aparece) |

Conclusão: única ocorrência visível da palavra "Renovar/Renove" pra usuário é o título de `Renew.tsx`. Trocar por "Sua fatura Pix" resolve.

## Canal discreto de cancelamento (cartão recorrente)

### Regra de exibição
Mostrar item **"Cancelar assinatura"** no dropdown Config **se e somente se**:
- `isActive === true` (subscription ativa)
- `subscription_state.asaas_customer_id IS NOT NULL` (não é premium manual da equipe)
- **NÃO** existe Pix pendente (`!hasPendingPixInvoice`) → indicativo de cartão recorrente

Por que essa heurística? Quem está em cartão recorrente quase nunca tem `next_invoice` Pix populada — Asaas debita automático. Quem tem Pix pendente vê "Fatura Pix" no menu (pra ele, "cancelar" = parar de pagar a próxima Pix, sem precisar de email).

### Comportamento
Click no item abre **AlertDialog** com:
- Título: "Precisa de ajuda com sua assinatura?"
- Texto: "Para qualquer ajuste na sua assinatura — pausar, alterar plano ou cancelar — envie um email para suporte@influlab.pro. Nossa equipe responde em até 24h e cuida de tudo pra você, sem complicação."
- Botão primário: **"Enviar email agora"** → `mailto:suporte@influlab.pro?subject=Ajuda com minha assinatura&body=Olá, preciso de ajuda com minha assinatura. Meu email cadastrado é: <user.email>`
- Botão secundário: "Voltar"

Sem botão "Cancelar agora" no app. Cancelamento self-service forçaria o cliente a tomar a decisão sozinho num clique — friction proposital pra dar à equipe a chance de reter.

### Por que via email e não chat/WhatsApp
Email cria registro escrito, dá tempo de retenção responder com proposta personalizada (desconto, pausa temporária), e evita "raivinha do cancelamento na hora". É padrão de SaaS B2C maduro (Notion, Loom, etc.).

## Mudanças no código

### 1. `src/pages/Renew.tsx`
Linha 110: `"Renove sua assinatura"` → `"Sua fatura Pix"`

### 2. `src/components/Navigation.tsx`
Adicionar:
- Import `MessageCircle` (ou `LifeBuoy`) do lucide
- Hook `useSubscription` (pra `isActive`) — já é usado indiretamente
- Estado `cancelHelpOpen`
- Lógica `showSubscriptionHelp = isActive && !hasPendingPixInvoice && session?.user`
- `DropdownMenuItem` "Ajuda com assinatura" abaixo de "Indicar amigos", visível só quando `showSubscriptionHelp`
- `AlertDialog` no JSX com texto/botões descritos acima
- O `mailto:` injeta o email do user logado no body

### 3. Não vou mexer em
- `AccessGuard` (texto já é neutro, "Pagar fatura pendente")
- `PixDueBanner` (texto já é neutro, "Sua fatura Pix...")
- Rota `/renovar` (URL técnica, ninguém digita)
- Edge functions, banco
- Fluxo Pix (intacto)

## Bloco copia-e-cola pra VPS

```bash
# nada a rodar na VPS — Vercel auto-deploya do GitHub
# (mudanças 100% frontend)
```

## Pergunta antes de aplicar

Confirma que quer canal **só por email** (suporte@influlab.pro) ou prefere também oferecer **WhatsApp** como opção alternativa no mesmo dialog? E o item de menu vai chamar **"Ajuda com assinatura"** (mais sutil) ou **"Cancelar/alterar assinatura"** (mais transparente, mas usa a palavra "cancelar")?
