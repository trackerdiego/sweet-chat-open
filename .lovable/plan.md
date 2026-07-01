## Diagnóstico

A Adriana pagou 2 vezes no Asaas. Você estornou uma. O Asaas disparou `PAYMENT_REFUNDED` e o webhook `asaas-webhook` (linhas 454-478) **desativa a conta incondicionalmente** em qualquer refund:

- seta `subscription_state.status = 'past_due'`
- seta `user_usage.is_premium = false`
- limpa `next_invoice`

Ele **não checa se ainda existe outro pagamento válido cobrindo o período atual**. Como o `AccessGuard` do app olha `useSubscription` (que exige `status ∈ {active, trial}` + `current_period_end > now`), ela caiu no bloqueio.

Obs.: o backend é self-hosted (`api.influlab.pro`), então nenhuma query aqui no Lovable Cloud enxerga a base dela — a auditoria/fix imediato precisa rodar no Studio self-hosted.

## Plano

### 1. Fix imediato para a Adriana (SQL manual no Studio self-hosted)

Bloco copia-e-cola que:
1. Acha o `user_id` pelo email em `auth.users`
2. Mostra o estado atual em `subscription_state` + últimos eventos em `asaas_webhook_events` pra confirmar que foi refund
3. Restaura `status='active'`, recalcula `current_period_end` a partir do pagamento válido remanescente (mensal +30d, anual +365d contados a partir do `paidDate` do pagamento que ficou), zera `next_invoice`
4. Marca `user_usage.is_premium = true`

Vou entregar em um único bloco com `BEGIN/COMMIT`, sem placeholder — você só troca a data do pagamento válido se necessário.

### 2. Fix no código do webhook (evita reincidência)

Editar `supabase/functions/asaas-webhook/index.ts` no bloco `PAYMENT_REFUNDED / PAYMENT_DELETED` (linhas 454-478):

- Antes de desativar, se tiver `apiKey` e `asaasSubId` **ou** `asaasCustomerId`, consultar `GET /payments?subscription=<id>&status=RECEIVED,CONFIRMED` (ou por customer) na API do Asaas
- Filtrar pagamentos cujo `paidDate + ciclo` (30d mensal / 365d anual) ainda esteja no futuro
- Se existir pelo menos 1 → **não desativar**; apenas logar `"Refund ignorado: assinatura ainda coberta por outro pagamento"` e, opcionalmente, atualizar `current_period_end` para o do pagamento válido mais longe
- `PAYMENT_OVERDUE` continua com o comportamento atual (não mexe em `next_invoice`, mas hoje ele também seta `past_due` — manter, é o correto pra vencido)
- Se não conseguir consultar Asaas (sem apiKey), manter comportamento antigo (fail-safe = desativar) mas logar warning

Nenhuma mudança em UI/frontend, nenhuma migration Lovable Cloud, nenhuma tabela nova.

### 3. Entrega VPS
Bloco final `cd /root/app && git pull && ./scripts/deploy-selfhost.sh asaas-webhook` pra você aplicar o fix do código.

## Arquivos afetados
- `supabase/functions/asaas-webhook/index.ts` — só o bloco 454-478
- SQL avulso pra Studio self-hosted (não entra no repo)