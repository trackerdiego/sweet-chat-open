## Validação end-to-end do padrão AI Jobs

Infra confirmada via headers (`x-influlab-function-version: ai-jobs-2026-04-28` em todas as 5 funções, Kong latency 1-7ms). Falta provar que o ciclo completo funciona.

### Passos

1. **Disparar job real via curl autenticado**
   - Chamar `start-tools-job` com payload mínimo (ex: `{ tool: "headline", input: "teste" }`) usando o JWT do usuário logado.
   - Confirmar resposta `{ jobId, status: "pending" }` em <2s.

2. **Verificar inserção no banco**
   - `SELECT id, job_type, status, started_at FROM ai_jobs ORDER BY created_at DESC LIMIT 5;`
   - Confirmar que o job apareceu como `pending` e migrou pra `processing`.

3. **Acompanhar worker em background**
   - Ler logs de `start-tools-job` pra ver o `EdgeRuntime.waitUntil` rodar e chamar Gemini.
   - Confirmar transição `processing → done` (ou `failed` com erro claro).

4. **Validar polling**
   - Chamar `get-ai-job-status?jobId=...` repetidas vezes.
   - Confirmar que retorna `{ status: "done", result: {...} }` quando o worker termina.

5. **Teste de stress de tempo (opcional)**
   - Disparar `start-script-job` (Gemini mais pesado) e medir tempo total até `done`.
   - Confirmar que o frontend nunca recebe timeout do Kong, mesmo se o worker levar 90s+.

6. **Teste no frontend real**
   - Pedir pro usuário rodar uma ferramenta na UI (Tools / ScriptGenerator / DailyGuide).
   - Conferir console/network: deve ter 1 POST <2s + N GETs de polling, sem 5xx.

### Critério de sucesso

- Nenhum 502/503/504 no fluxo
- `ai_jobs` com status final `done`
- Frontend recebe resultado via polling sem erro

### O que vou usar

- `supabase--curl_edge_functions` (com auth do user logado) pra disparar e pollar
- `supabase--read_query` pra inspecionar `ai_jobs`
- `supabase--edge_function_logs` pra ver o worker rodando

Sem mudanças de código nesse passo — só validação. Se algum passo falhar, abro plano de fix específico.
