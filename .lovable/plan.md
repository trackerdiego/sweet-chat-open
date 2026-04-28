## Dashboard de Lançamento no /admin

Transformar todas aquelas queries SQL chatas em uma aba visual no painel admin, com auto-refresh de 30s e ação de reprocessar evento Asaas direto pela UI (sem precisar de SSH na VPS).

## Como vai ficar

```
/admin
├── Aba "Usuários" (já existe — intocada)
└── Aba "Saúde do Lançamento" (NOVA)
    ├── 4 cards de KPI no topo (auto-refresh 30s)
    │   ├── 💰 Pagantes ativos + MRR + novos hoje
    │   ├── 🔔 Webhooks Asaas (24h): X processados, Y falhas
    │   ├── 🤖 AI Jobs (24h): % sucesso, p95 latência
    │   └── 🚀 Onboarding (24h): % conclusão, abandono médio
    │
    ├── Seção "Pagantes & Receita"
    │   ├── MRR atual (mensal × 47 + anual × 24,75)
    │   ├── Novos pagantes hoje / 7d / 30d
    │   ├── Trials vencendo nos próximos 7 dias (lista)
    │   ├── Cancelamentos recentes (status='canceled')
    │   └── Tabela de últimos 20 pagantes (nome, plano, próx. cobrança)
    │
    ├── Seção "Webhooks Asaas" 🛡️
    │   ├── Lista últimos 50 eventos (event_type, user, status colorido, recebido_em)
    │   ├── Linha vermelha se processing_error OU processed_at IS NULL > 1min
    │   ├── Botão 🔍 "Ver payload" → modal com JSON formatado
    │   ├── Botão 🔄 "Reprocessar" → chama webhook com x-cron-secret pela UI
    │   └── Alerta no topo se houver pagante órfão (premium=true sem subscription_id, excluindo equipe)
    │
    ├── Seção "AI Jobs"
    │   ├── Stats por job_type (start-script, start-tools, start-daily-guide, start-transcription)
    │   ├── % completed / failed / pending nas últimas 24h
    │   ├── Latência p50 e p95 (completed_at - started_at)
    │   └── Lista últimos 20 failed com error_message (modal pra ver completo)
    │
    └── Seção "Onboarding Runs"
        ├── % de conclusão (completed / total) nas últimas 24h
        ├── Em qual stage as pessoas mais abandonam (1, 2, 3 ou 4)
        ├── Tempo médio do fluxo (completed_at - created_at)
        └── Lista últimos 20 runs failed com error_message
```

## Arquitetura técnica

### 1. Nova edge function: `admin-launch-health`
- Mesma autorização do `admin-dashboard` (valida `agentevendeagente@gmail.com`)
- Retorna JSON único com todas as métricas das 4 seções (1 chamada só, mais leve)
- Lê: `asaas_webhook_events`, `subscription_state`, `ai_jobs`, `onboarding_runs`
- Cache interno de 10s pra evitar bombardear o banco com refresh de 30s

### 2. Nova ação na `asaas-webhook` (já existe parcialmente)
- O modo `reprocess` já está implementado e validado (HTTP 200 confirmado hoje)
- Frontend chama com `x-cron-secret` que precisa ficar disponível pra função admin

**Ponto de atenção de segurança**: o `x-cron-secret` NÃO pode ir pro frontend. Solução: criar uma nova action `admin-reprocess-asaas-event` (function intermediária) que:
- Valida que o caller é o admin
- Chama internamente `asaas-webhook` com o secret do servidor
- Retorna o resultado pro frontend

### 3. Nova aba no `src/pages/Admin.tsx`
- Tabs do shadcn (Usuários | Saúde do Lançamento)
- Componente `LaunchHealthDashboard.tsx` com `useQuery` + `refetchInterval: 30000`
- Modais usando `Dialog` do shadcn pra "Ver payload" e "Ver erro completo"
- Cores semânticas via design tokens (verde sucesso, vermelho erro, amarelo aviso)

### 4. Sem migrations de banco
Tudo baseado em tabelas que já existem (`asaas_webhook_events`, `subscription_state`, `ai_jobs`, `onboarding_runs`). Zero schema change.

## Auto-refresh 30s

- React Query com `refetchInterval: 30000` no hook do dashboard
- Indicador visual sutil "Atualizado há Xs" no canto
- Pausa o refresh quando aba do navegador não está visível (`refetchIntervalInBackground: false`) pra economizar Gemini/Kong

## Ações 1-clique (escopo confirmado)

1. **Ver payload bruto** — abre modal com JSON colorido + botão "Copiar"
2. **Reprocessar evento Asaas** — chama nova function `admin-reprocess-asaas-event`, mostra toast com resultado, recarrega a lista

## O que NÃO vou fazer (ficou de fora propositalmente)

- Reconciliar usuário órfão pela UI (você confirmou hoje que não tem órfão real)
- Toggle premium manual (continuar via SQL pra evitar acidente)
- Realtime do Supabase (auto-refresh 30s já é suficiente, mais simples)

## Entregáveis ao final

1. Migration: nenhuma (zero schema change)
2. 2 edge functions novas: `admin-launch-health` + `admin-reprocess-asaas-event`
3. Frontend: nova aba `Admin.tsx` + componente `LaunchHealthDashboard.tsx`
4. Bloco de deploy VPS no fim da resposta:
   ```bash
   cd /root/app && git pull origin main && \
   ./scripts/deploy-selfhost.sh admin-launch-health admin-reprocess-asaas-event
   ```

## Riscos

- **Risco**: refresh de 30s × várias queries pesa no banco
  - **Mitigação**: cache de 10s na function + filtro de janela 24h (índices já existem)
- **Risco**: x-cron-secret vazar pro frontend
  - **Mitigação**: function intermediária `admin-reprocess-asaas-event` que valida admin antes de usar o secret
- **Risco**: aba quebra se backend self-hosted estiver offline
  - **Mitigação**: error boundary com mensagem clara + botão "Tentar de novo"

---

**Aprova clicando no botão abaixo** que eu escrevo as 2 functions + a aba nova + te mando o bloco de deploy VPS na mesma resposta. ⚡