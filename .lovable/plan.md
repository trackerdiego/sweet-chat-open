## Visão de escala

A correção anterior já resolve o problema pra todos os usuários (não só pra você): cancela runs zumbis no servidor, guarda em todas etapas, delete-then-insert, e descarta runs > 10 min. Mas faltam 3 endurecimentos pra aguentar centenas de usuários simultâneos sem criar novos órfãos.

## Plano

### 1. Janitor automático de runs travados (novo cron)
Hoje, se um worker morre no meio (OOM, deploy, crash), `onboarding_runs.status` fica `running` pra sempre — ocupa polling do frontend infinitamente e bloqueia novas tentativas até o usuário fechar a aba.

**Fix:** edge function `cleanup-stuck-runs` chamada por cron a cada 5 min:
```sql
update onboarding_runs
   set status='failed', error_message='worker timeout (>5min sem update)', completed_at=now()
 where status in ('pending','running')
   and updated_at < now() - interval '5 minutes';
```
Dispara via `pg_cron` (já tem no self-hosted) ou cron HTTP externo.

### 2. Constraint de DB: no máximo 1 run ativo por usuário
Sem isso, dois cliques rápidos em "Começar" criam dois `INSERT` simultâneos (a checagem JS não é atômica) → dois workers competindo pelo mesmo `user_strategies`.

**Fix:** índice único parcial:
```sql
create unique index if not exists onboarding_runs_one_active_per_user
  on public.onboarding_runs(user_id)
  where status in ('pending','running');
```
Combinado com o cancel-old-runs que já fizemos (que vira `failed` antes do `INSERT`), garante atomicidade no DB — se uma race driblar a aplicação, o constraint barra.

### 3. Limpar localStorage no logout
Hoje, se Usuário A faz logout em desktop público e Usuário B loga, o `influlab.onboardingRunId` do A persiste e B pode acabar fazendo polling de um run alheio. RLS protege os dados, mas o estado de UI fica esquisito.

**Fix:** em `useUserProfile.signOut()`, remover `influlab.onboardingRunId` (junto com `influlab_session_token` que já é limpo).

### 4. Job-level user_id check no polling
`get-onboarding-run-status` já filtra por usuário (RLS), mas adicionar checagem explícita `user_id === auth.uid()` antes de retornar é defesa em profundidade — protege contra um runId vazado em logs/URL.

### 5. SQL pra rodar agora no Studio self-hosted
Combina: (a) índice único, (b) cleanup imediato de TODOS os runs travados de TODOS os usuários, (c) reset específico do seu user (`agentevendeagente@gmail.com`).

```sql
-- (a) Constraint estrutural — vale pra todos os usuários daqui pra frente
create unique index if not exists onboarding_runs_one_active_per_user
  on public.onboarding_runs(user_id)
  where status in ('pending','running');

-- (b) Limpa TODOS os runs zumbis de TODOS os usuários (one-shot, antes do cron entrar)
update public.onboarding_runs
   set status='failed',
       error_message='backfill: stuck run cleanup',
       completed_at=now(),
       updated_at=now()
 where status in ('pending','running')
   and updated_at < now() - interval '5 minutes';

-- (c) Reset do SEU user (agentevendeagente@gmail.com) pra refazer onboarding limpo
with me as (select id from auth.users where email='agentevendeagente@gmail.com')
update public.onboarding_runs
   set status='failed', error_message='manual reset', completed_at=now(), updated_at=now()
 where user_id = (select id from me) and status in ('pending','running');

delete from public.user_strategies
 where user_id = (select id from auth.users where email='agentevendeagente@gmail.com');

delete from public.audience_profiles
 where user_id = (select id from auth.users where email='agentevendeagente@gmail.com');

update public.user_profiles
   set onboarding_completed=false, description_status='pending', primary_niche='lifestyle'
 where user_id = (select id from auth.users where email='agentevendeagente@gmail.com');
```

### 6. Cron pg_cron (uma vez no Studio, fica rodando pra sempre)
```sql
select cron.schedule(
  'onboarding-runs-janitor',
  '*/5 * * * *',
  $$ update public.onboarding_runs
        set status='failed',
            error_message='janitor: no heartbeat 5min',
            completed_at=now(),
            updated_at=now()
      where status in ('pending','running')
        and updated_at < now() - interval '5 minutes' $$
);
```

## Arquivos a tocar

| Arquivo | Mudança |
|---|---|
| `src/hooks/useUserProfile.ts` | `signOut()` remove `influlab.onboardingRunId` do localStorage |
| `supabase/functions/get-onboarding-run-status/index.ts` | Confirmar (e adicionar se faltar) `user_id===auth.uid()` antes de retornar |
| SQL manual (Studio) | Índice único + backfill + cron janitor + reset do seu user |

Não toca em prompts, geração de matriz, ou worker (já blindado na rodada anterior). Foco: durabilidade operacional pra escala.
