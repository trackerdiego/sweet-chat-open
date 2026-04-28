## Auditoria — resultado em 1 frase

O sistema de coins **funciona pro plano mensal com 2 bugs** (teto 50% não aplicado, idempotência depende de constraint que não consigo verificar do Lovable) e **não funciona pro plano anual** (a regra "+30 dias a cada 2.475 coins" só existe no texto da Central de Ajuda, não no código).

---

## Plano de execução (4 frentes, 1 rodada)

### Frente 1 — SQL de auditoria + correção (você roda no Studio self-hosted)

Vou gerar **um único bloco SQL** em `/mnt/documents/audit-coins.sql` que faz:

1. **Verifica** se existe `UNIQUE (user_id, reference_id)` em `coin_transactions`. Se não existir, **cria** (sem isso, `award_task_coins` pode duplicar coins).
2. **Lista** cron jobs ativos (`cron.job`) pra confirmar se `apply-monthly-discounts` está agendado. Se não estiver, te entrego o SQL pra agendar (diário às 03:00 BRT).
3. **Lista** o estado atual da função `award_task_coins` (confirma que existe).
4. **Diagnóstico de dados**: conta `coin_transactions` últimos 30 dias por tipo, total de wallets com saldo > 0, redemptions já aplicadas.

Você cola no Studio, me devolve o output, eu interpreto.

### Frente 2 — Implementar regra do anual no `apply-monthly-discounts`

Refatorar a edge function pra ter **dois branches**:

- **`plan = 'monthly'`** (lógica atual, com correção do teto):
  - Teto = `min(saldo_disponível, fullPrice * 0.5)` em vez de `fullPrice - 1`.
  - Resto idêntico (PATCH value, registra redemption, debita wallet, webhook reverte).

- **`plan = 'annual'`** (NOVO):
  - Roda **mensalmente** (não só perto da renovação) — ajusto o filtro pra não exigir `current_period_end` próximo no caso anual.
  - Idempotência por mês: `monthly_redemptions.period_month` continua sendo a chave.
  - Lê `coins_balance`. Se ≥ 2.475:
    - `meses_extras = floor(coins_balance / 2475)`, com cap de 6 por ciclo de 12 meses (consulta `monthly_redemptions` últimos 12 meses).
    - PATCH no Asaas: `nextDueDate` = `current_period_end + (meses_extras * 30 dias)`.
    - Sincroniza `subscription_state.current_period_end` com a nova data.
    - Debita `meses_extras * 2475` coins.
    - Insere em `monthly_redemptions` com `coins_used`, `discount_brl_total = 0` (não é desconto), e novo campo `metadata` em `coin_transactions` indicando `extra_days`.

### Frente 3 — Webhook não precisa reverter no anual

Atualizar `revertSubscriptionValueIfDiscounted` pra **só reverter `value` se a redemption foi do tipo desconto** (mensal). No anual, mexemos em `nextDueDate`, não em `value`, então não há nada pra reverter.

### Frente 4 — Sincronizar texto da Central de Ajuda

Hoje o `src/pages/Help.tsx` diz "+30 dias a cada 2.475 coins, máx 6 meses/ano" e "teto 50% no mensal". Depois das frentes 2 e 3 isso passa a ser verdade — então o texto fica como está. Único ajuste: deixar **mais explícito que o anual recebe o benefício a cada mês**, não só na renovação (hoje pode soar ambíguo).

### Frente 5 — Bug menor de console (orphan lock)

Os warnings `Lock "lock:sb-api-auth-token" was not released` em `useWallet.ts:19` vêm de várias chamadas paralelas a `supabase.auth.getSession()`. Vou trocar por uma única chamada cacheada. Não quebra nada, só limpa console.

---

## Detalhes técnicos

### Arquivos que serão modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/apply-monthly-discounts/index.ts` | Branch monthly (teto 50%) + branch annual (estende nextDueDate) |
| `supabase/functions/asaas-webhook/index.ts` | `revertSubscriptionValueIfDiscounted` checa `discount_brl_total > 0` antes de reverter |
| `src/hooks/useWallet.ts` | Cachear `getSession()` numa única chamada |
| `src/pages/Help.tsx` | Pequeno ajuste de copy no item do anual |
| `/mnt/documents/audit-coins.sql` | Novo — script de auditoria pra você rodar no Studio |

### Bloco copia-e-cola pra VPS (gerado ao final)

```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh apply-monthly-discounts asaas-webhook
```

### O que NÃO vou fazer

- **Não vou criar migration Lovable** pra `UNIQUE` em `coin_transactions` — backend é self-hosted, migration aqui não chega lá. Vai no SQL da Frente 1.
- **Não vou agendar cron** — depende de saber se já existe um. Se não existir, te entrego o SQL `cron.schedule(...)` separado, pra você rodar com a anon key dele.
- **Não vou tocar em SMTP / templates de email** (regra do projeto).

---

## Confirma?

Se topar, eu mando tudo na próxima rodada: SQL de auditoria + 2 edge functions reescritas + fix do useWallet + ajuste de copy + bloco de deploy.