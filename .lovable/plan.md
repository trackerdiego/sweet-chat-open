## Problema

Depois que migramos `script`, `tools` e `daily-guide` para o padrão de jobs assíncronos, o painel admin **parou de mostrar incremento** em `script_generations`, `tool_generations` e os totais derivados.

## Causa

Antes da migração, o frontend (`ScriptGenerator`, `Tools`, `DailyGuide`) chamava `incrementUsage(...)` no React após o sucesso da geração — isso atualizava `user_usage` e o painel admin lia esses números.

Na refatoração para jobs assíncronos:

- O servidor (`start-script-job`, `start-tools-job`, `start-daily-guide-job`) agora faz o `update` em `user_usage` dentro do worker em background, e também grava em `usage_logs`.
- O frontend deixou de chamar `incrementUsage` para script, tool e daily-guide (continua chamando só pra `transcriptions` e `chat`).

Resultado:

```text
Frontend ──invoke──► start-*-job ──202 jobId──► return
                               │
                               └─► waitUntil(worker)
                                     ├─ update user_usage  ← falha silenciosa em alguns casos
                                     ├─ insert usage_logs
                                     └─ update ai_jobs status=done
```

Quando o worker em background falha parcialmente (Gemini erra DEPOIS, ou o `waitUntil` é cortado pela infra self-hosted), o `ai_jobs` chega a `failed`/`done`, mas o `update user_usage` pode:

1. Acontecer antes do erro (caso `done`) — funciona,
2. Não acontecer (caso `failed`) — esperado, mas o frontend também não conta mais nada,
3. Acontecer mas o cache do React (`useUserUsage`) não recarregar — o painel admin lê do banco direto, então isso não afeta o admin, apenas o UI do criador.

Mas o ponto principal é: **o cache local de `useUserUsage` no frontend não é atualizado** depois do job assíncrono terminar com sucesso. O painel admin (que lê do banco via `admin-dashboard`) **deveria** ver o incremento — e provavelmente vê quando o worker conclui.

Precisamos verificar duas coisas:

1. Os updates de `user_usage` no worker estão chegando ao banco self-hosted em produção?
2. O cache do hook `useUserUsage` no frontend precisa recarregar após o job, para o usuário ver o contador atualizado.

## Plano

### 1. Garantir incremento no servidor + refresh no cliente

Para cada job de IA bem-sucedido:

- **Servidor (já implementado)**: continuar fazendo `update user_usage` + `insert usage_logs` dentro do worker. Adicionar `console.log` dedicado ("usage incremented for script/tools/daily-guide") para conseguirmos ver nos logs do Docker se o update chegou a rodar.
- **Cliente**: depois do job retornar `done`, chamar uma função `refreshUsage()` no hook `useUserUsage` que re-busca a row de `user_usage` do banco — em vez de incrementar local. Assim o número mostrado pro usuário fica em sincronia com o banco/admin sem dupla contagem.

### 2. Adicionar `refreshUsage` em `useUserUsage`

No `src/hooks/useUserUsage.ts`:

- Extrair a lógica de fetch atual para uma função `refreshUsage` exposta junto com `incrementUsage`.
- `incrementUsage` continua existindo (usado por `transcriptions` e chat), mas script/tools/daily-guide passam a chamar `refreshUsage()` após sucesso do job.

### 3. Atualizar componentes que usam jobs

- `src/components/ScriptGenerator.tsx`: após `runScriptJob()` resolver, chamar `await refreshUsage()`.
- `src/pages/Tools.tsx` (`handleGenerate`): após `runAiJob('start-tools-job', ...)`, chamar `await refreshUsage()`.
- `src/components/DailyGuide.tsx`: após o job terminar, chamar `await refreshUsage()`.
- Para `transcriptions`, manter `await incrementUsage('transcriptions')` OU trocar também por `refreshUsage()` já que o worker do `start-transcription-job` também faz update server-side (preferência: `refreshUsage()` para evitar dupla contagem).

### 4. Validar pelo painel admin

Após deploy, gerar 1 script, 1 tool, 1 daily-guide e 1 transcrição com o usuário de teste e conferir no `/admin`:

- contadores `script_generations`, `tool_generations`, `transcriptions` aumentam,
- `usage_logs` registra cada feature,
- `ai_jobs` mostra o job correspondente em `done`.

### 5. Diagnóstico SQL pós-deploy (rodar no Studio self-hosted)

```sql
-- Conferir se updates de user_usage estão acompanhando os jobs done
SELECT
  j.id, j.job_type, j.status, j.completed_at,
  u.script_generations, u.tool_generations, u.transcriptions,
  u.last_script_date, u.last_tool_date, u.last_transcription_date
FROM ai_jobs j
LEFT JOIN user_usage u ON u.user_id = j.user_id
ORDER BY j.created_at DESC
LIMIT 20;

-- Logs por dia
SELECT feature, COUNT(*), MAX(created_at)
FROM usage_logs
WHERE created_at > now() - interval '7 days'
GROUP BY feature;
```

## Arquivos a alterar

- `src/hooks/useUserUsage.ts` — expor `refreshUsage`
- `src/components/ScriptGenerator.tsx` — chamar `refreshUsage` após sucesso
- `src/pages/Tools.tsx` — chamar `refreshUsage` após sucesso (tools + transcrição)
- `src/components/DailyGuide.tsx` — chamar `refreshUsage` após sucesso
- (opcional) `supabase/functions/start-*-job/index.ts` — adicionar `console.log` claro do passo "usage incremented" pra facilitar debug no Docker

## Deploy depois

Frontend (Vercel) sai automático no push pra `main`.

Edge functions (só se mexermos nos logs do servidor):

```bash
cd /root/app && git pull origin main
./scripts/deploy-selfhost.sh start-script-job start-tools-job start-daily-guide-job start-transcription-job
```

## Resultado esperado

- Painel admin volta a refletir as gerações corretamente.
- O contador no UI do criador também atualiza após cada geração assíncrona.
- Sem dupla contagem (cliente não incrementa por conta própria).
- Logs do Docker mostram explicitamente quando o `user_usage` é atualizado, facilitando debug futuro.
