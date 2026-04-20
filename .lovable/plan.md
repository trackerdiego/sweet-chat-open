
User quer o SQL pra rodar no Studio self-hosted (a tabela `push_send_log` que a edge function `scheduled-push` agora usa pra dedup).

Como o backend é self-hosted, migrations Lovable não chegam lá — entrego como bloco SQL pra colar manualmente.

## SQL pra rodar no Supabase Studio self-hosted

Cole no **SQL Editor** de `https://api.influlab.pro` (ou onde estiver o Studio do self-hosted):

```sql
-- 1. Tabela de log de envios (1 registro por user/dia/bloco)
create table if not exists public.push_send_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  send_date date not null,
  block text not null check (block in ('morning','afternoon','evening')),
  created_at timestamptz not null default now(),
  unique (user_id, send_date, block)
);

-- 2. Index pra lookup rápido por dia
create index if not exists idx_push_send_log_date_block
  on public.push_send_log (send_date, block);

-- 3. RLS — só service_role escreve/lê (edge function usa service key)
alter table public.push_send_log enable row level security;

create policy "service role full access push_send_log"
  on public.push_send_log
  for all
  to service_role
  using (true)
  with check (true);

-- 4. Limpeza automática: apaga registros > 7 dias (roda 1x por dia às 3h BR / 6h UTC)
create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-push-send-log-daily',
  '0 6 * * *',
  $$ delete from public.push_send_log where send_date < current_date - interval '7 days'; $$
);
```

## Como validar

Depois de rodar:

```sql
-- Confere que tabela existe
select count(*) from public.push_send_log;

-- Confere que cron tá agendado
select jobname, schedule, active from cron.job where jobname like '%push%';
```

Esperado:
- Primeiro select retorna `0` (vazio).
- Segundo select mostra 2 jobs: `scheduled-push-15min` (já existente) + `cleanup-push-send-log-daily` (novo).

## O que isso resolve

A edge function `scheduled-push` (já redeployada) agora faz `INSERT` em `push_send_log` **antes** de chamar `send-push`. O `unique (user_id, send_date, block)` garante que mesmo se o cron disparar 4x na mesma janela (manhã/tarde/noite), só o primeiro consegue inserir — os outros falham silenciosamente e pulam o envio.

Resultado: máximo de **3 pushes/dia por usuário** (um por bloco), em vez dos ~20 que estavam chegando.

## Próximo passo após rodar SQL

Pra testar sem esperar o cron:
```bash
curl -X POST https://api.influlab.pro/functions/v1/scheduled-push \
  -H "Content-Type: application/json" \
  -d '{"block":"afternoon"}'
```
Roda 2x seguidas. A primeira deve mostrar `sent: N`, a segunda `sent: 0, skipped: N` — confirma que a dedup funciona.
