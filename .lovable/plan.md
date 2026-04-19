

User wants:
1. Check-up on payment integration (Asaas)
2. Tell which webhook events to enable in Asaas panel
3. Check if features are working right now for live users

I'm in plan mode (read-only). Let me plan the investigation + deliverables.

What I'll inspect:
- `asaas-webhook` and `create-asaas-subscription` code (already shown — I have it)
- Edge function logs for both functions (recent activity)
- DB queries: recent `user_usage` premium activations, recent signups, recent strategies generated, recent usage_logs
- Edge logs for `ai-chat`, `generate-*` to see if Gemini-direct refactor is working
- Auth logs for recent errors

## Plan

### 1. Auditoria de pagamentos (código + dados reais)
- Reler `asaas-webhook/index.ts` e `create-asaas-subscription/index.ts` (já em contexto) — validar fluxo end-to-end
- Query no DB: últimas ativações `is_premium=true` em `user_usage` (últimos 7 dias)
- Edge logs de `asaas-webhook` (últimas 24h) — confirmar se Asaas está chamando e respondendo 200
- Edge logs de `create-asaas-subscription` — checar erros de criação de cliente/assinatura
- Verificar se `ASAAS_WEBHOOK_TOKEN` confere com o que tá no painel Asaas (via teste de token rejeitado nos logs)

### 2. Lista de eventos Asaas pra ativar no webhook
Baseado no código atual de `asaas-webhook`, os eventos tratados são:

**Ativam premium:**
- `PAYMENT_CONFIRMED` — pagamento confirmado (cartão/pix/boleto)
- `PAYMENT_RECEIVED` — pagamento recebido (compensado)

**Desativam premium:**
- `PAYMENT_OVERDUE` — pagamento atrasado
- `PAYMENT_REFUNDED` — estornado
- `PAYMENT_DELETED` — pagamento deletado
- `SUBSCRIPTION_DELETED` — assinatura cancelada
- `SUBSCRIPTION_INACTIVE` — assinatura inativa

Vou entregar a lista exata pra marcar no painel Asaas (Integrações → Webhooks → Eventos).

### 3. Health-check funcional (uso real agora)
- DB: `auth.users` últimos cadastros (24h), `user_profiles.onboarding_completed`, `audience_profiles` gerados, `user_strategies` gerados
- Edge logs (últimas 24h) por function: `ai-chat`, `generate-audience-profile`, `generate-personalized-matrix`, `generate-daily-guide`, `generate-script`, `generate-tools-content`, `transcribe-media`
- Buscar erros 5xx, timeouts, "GEMINI" key issues
- Auth logs: erros de signup/login

### 4. Relatório final consolidado
Entrego em 3 blocos:
- ✅/❌ **Pagamentos**: status do webhook, exemplos reais de ativação, gaps
- 📋 **Eventos Asaas**: checklist exato pra marcar no painel
- 🩺 **Saúde do app agora**: cada feature com status (auth, onboarding, IA generations, transcrição, push, pagamentos)

### Ferramentas que vou usar (modo default)
- `supabase--read_query` — consultas no DB
- `supabase--edge_function_logs` — logs por function
- `supabase--analytics_query` — auth_logs e function_edge_logs agregados
- `supabase--curl_edge_functions` — smoke test do `asaas-webhook` (com token inválido → deve retornar 401)
- `code--view` em `supabase/functions/asaas-webhook/index.ts` (confirmar — já vi)

Sem mudanças de código nesta rodada — só diagnóstico. Se achar bug, reporto e proponho fix em mensagem separada.

