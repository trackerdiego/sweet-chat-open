Diagnóstico:
- O print confirma que `daily_hype_raw` tem dados: `youtube = 25` e `google_trends = 10`.
- Então o problema não é falta de tendências nem exibição do card.
- A mensagem “Não foi possível iniciar o job” nasce antes da IA e antes da leitura das trends: ela vem de `ai-job-runner.ts` quando falha o `insert` em `public.ai_jobs`.
- O motivo mais provável está claro nas migrations: a tabela `ai_jobs` foi criada com `CHECK (job_type IN ('tools', 'script', 'daily_guide', 'transcription'))`, mas o Hype tenta inserir `job_type = 'hype'`. Se o self-hosted ainda tem esse constraint antigo, o insert é bloqueado e a função devolve exatamente essa mensagem genérica.

Plano de correção:

1. Corrigir o schema no Supabase self-hosted
- Entregar SQL para rodar no Studio self-hosted que remove o constraint antigo de `ai_jobs.job_type` e recria aceitando também:
  - `task_examples`
  - `hype`
- Garantir também as colunas opcionais já usadas pelo polling/logs:
  - `attempts`
  - `model_used`

2. Adicionar uma migration local/documentada no projeto
- Criar uma migration no repositório com o mesmo ajuste, para o schema versionado ficar correto daqui pra frente.
- Mesmo sabendo que Lovable migrations não aplicam no self-hosted, isso evita o bug voltar em ambientes novos.

3. Melhorar o erro da Edge Function
- Em `_shared/ai-job-runner.ts`, quando falhar ao inserir `ai_jobs`, retornar uma mensagem mais diagnóstica apenas para esse caso, sem vazar secrets.
- Exemplo: se for violação de constraint em `job_type`, responder algo como: “Tipo de job não aceito no banco. Atualize o schema de ai_jobs.”

4. Bloco de aplicação na VPS/self-hosted
- Entregar os comandos finais:
  - `git pull`
  - deploy das functions
  - SQL para rodar no Studio self-hosted

SQL principal que será entregue:
```sql
alter table public.ai_jobs
  drop constraint if exists ai_jobs_job_type_check;

alter table public.ai_jobs
  add constraint ai_jobs_job_type_check
  check (job_type in ('tools', 'script', 'daily_guide', 'transcription', 'task_examples', 'hype'));

alter table public.ai_jobs add column if not exists attempts int;
alter table public.ai_jobs add column if not exists model_used text;
```

Resultado esperado:
- `start-hype-job` conseguirá criar a linha em `ai_jobs`.
- O frontend receberá `jobId`.
- O polling continuará em `get-ai-job-status`.
- Como já existem trends coletadas, o Hype do Dia deve gerar os 5 itens em vez de parar em “Não foi possível iniciar o job”.