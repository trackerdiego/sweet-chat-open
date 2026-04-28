## Problema

A regra atual de coins assume cobrança recorrente mensal. No anual o usuário paga R$ 297 uma vez e só renova daqui a 12 meses — então "desconto na próxima fatura" vira "desconto daqui a 1 ano", o que mata o incentivo do sistema.

## Decisão tomada

- **Mensal** → continua como está: coins viram desconto na próxima fatura (teto 50%).
- **Anual** → coins viram **dias extras de plano** acrescentados ao fim da assinatura. Quando o usuário acumular o equivalente a um mês, ganha +30 dias de plano grátis. Saldo zera após resgate.

## Como funciona o resgate no anual

1. Conversão: 1 coin = R$ 0,01 (mantém a mesma régua do mensal).
2. Limiar para resgate: equivalente a **R$ 24,75** (o "preço justo" mensal do anual) = **2.475 coins**. Atingiu, vira +30 dias automaticamente.
3. Múltiplos: pode resgatar várias "doses" (5.000 coins → +60 dias, e assim por diante).
4. Teto anual: até **+6 meses extras por ciclo de 12 meses** (mesma lógica de "50% do plano" — meio ciclo grátis no máximo).
5. Aplicação: cron mensal verifica saldo de usuários anuais; se ≥ 2.475 coins, faz `PATCH` em `nextDueDate` da subscription Asaas (+30 dias por dose), debita coins, registra em `monthly_redemptions`.
6. Restante do saldo (< 2.475 coins) acumula pro mês seguinte.

## O que muda na Central de Ajuda (`/ajuda`)

Reescrever a seção "Como vira desconto" e "Regras importantes" para deixar as duas trilhas explícitas:

```
Como vira benefício
- Plano mensal: seus coins viram desconto direto na próxima fatura.
- Plano anual: seus coins viram dias extras de plano, somados ao fim
  da sua assinatura. A cada 2.475 coins acumulados, você ganha +30
  dias grátis automaticamente.

Regras importantes
- Mensal: desconto máximo de 50% do valor do plano (até R$ 23,50/mês).
- Anual: até +6 meses extras por ciclo de 12 meses (também 50% do plano).
- Coins não expiram enquanto sua assinatura estiver ativa.
- Se o pagamento falhar, o desconto/extensão é revertido e os coins voltam.
- Coins são pessoais e não podem ser transferidos.
```

E no FAQ trocar "Quanto tempo até virar desconto?" por duas perguntas:
- **No mensal:** aplicado automaticamente na próxima cobrança.
- **No anual:** sempre que você bater 2.475 coins, ganha +30 dias no fim da sua assinatura.

## O que muda no backend (não nesta rodada — só sinalizar)

Esta tarefa cobre **apenas a comunicação na Central de Ajuda**. A lógica do cron `apply-monthly-discounts` hoje só sabe descontar valor de fatura mensal — para entregar a regra do anual de verdade, vai precisar de uma rodada separada que:

1. Detecta `subscription_state.plan = 'annual'` e desvia para o branch de "estender prazo" (`PATCH` em `nextDueDate` ao invés de `value`/`discount`).
2. Cria entrada em `monthly_redemptions` registrando dias estendidos em vez de R$.
3. Reverte a extensão se o webhook Asaas marcar pagamento falhado.

Confirme se faz sentido e, depois de aprovar a parte da Help, abro a próxima rodada para a edge function. Não estou mexendo em backend agora pra não atrasar a correção do texto.

## Arquivos afetados nesta rodada

- `src/pages/Help.tsx` — reescreve seção "Como vira desconto", "Regras importantes" e FAQ.

## Deploy

Frontend-only (Vercel auto-deploy). Sem comandos VPS, sem migrations.
