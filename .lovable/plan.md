## Problema

`start-onboarding-run` retorna **500** ao apertar "Começar Jornada" (passo 2). O frontend só mostra `Edge Function returned a non-2xx status code` porque o `supabase.functions.invoke` engole o corpo da resposta. Sem o erro real, é chute.

## Plano

### 1. Surfar a mensagem real do erro no frontend
Em `src/hooks/useOnboardingRun.ts`, função `start()`: quando `supabase.functions.invoke` falhar, ler `error.context?.json()` ou fazer fetch manual com `.text()` pra capturar o `error` / `detail` que a edge function já retorna no body. Mostrar isso no toast em vez do genérico.

### 2. Capturar erro completo em `start-onboarding-run`
- O outer try/catch hoje retorna só `{ error: e.message }`. Adicionar `stack` e `name` no JSON quando `Deno.env.get("DEBUG_ERRORS") === "1"`.
- Logar `console.error` antes de retornar pra cair no Docker logs do `functions` service.

### 3. Comandos de diagnóstico (rodar AGORA na VPS)

**A) Pegar logs ao vivo do worker:**
```bash
ssh root@SEU_IP
cd ~/supabase/docker
docker compose logs -f functions --tail=200 | grep -E "start-onboarding|run-|error|ERROR"
```
Mantém aberto, vai no app, aperta "Começar Jornada" → erro aparece no log.

**B) Ver últimos runs do user no Studio (`https://studio.influlab.pro` → SQL):**
```sql
select id, status, current_stage, error_message, stages, created_at, completed_at
from public.onboarding_runs
where user_id = (select id from auth.users where email = 'agentevendeagente@gmail.com')
order by created_at desc limit 10;

-- Limpa runs antigos (incluindo qualquer 'pending' fantasma)
update public.onboarding_runs
   set status = 'failed', completed_at = coalesce(completed_at, now())
 where user_id = (select id from auth.users where email = 'agentevendeagente@gmail.com')
   and status in ('pending','running');

-- Reseta perfil pra ter certeza
update public.user_profiles
   set onboarding_completed = false, description_status = 'pending', primary_niche = 'lifestyle'
 where user_id = (select id from auth.users where email = 'agentevendeagente@gmail.com');

delete from public.user_strategies
where user_id = (select id from auth.users where email = 'agentevendeagente@gmail.com');
```

**C) Limpar localStorage** — F12 no app → Application → Local Storage → remover `influlab.onboardingRunId`.

### 4. Deploy do fix da matriz (que já fiz no loop anterior)
Como você ainda não rodou o deploy do meu fix, o código novo (timeouts maiores + sequencial + retry) ainda nem está em produção. Aproveita e sobe junto:
```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh start-onboarding-run
```

### 5. Reproduzir e me mandar o log
Depois de A+B+C+4, refaz o onboarding. Se ainda der 500, me cola **a linha exata** do `docker compose logs functions` que apareceu no momento do clique. Aí eu corrijo a causa raiz com precisão (se for Gemini key, RLS, timeout, parse, etc).

## Arquivos previstos (loop seguinte, depois do diagnóstico)

- `src/hooks/useOnboardingRun.ts` (mensagem de erro detalhada no toast)
- `supabase/functions/start-onboarding-run/index.ts` (logs + body de erro mais rico)
- Possivelmente outras correções dependendo do que o log mostrar

## Resultado esperado

- Você consegue ver o erro real (mensagem + stack) no toast e no log do Docker.
- Eu consigo apontar a correção exata em 1 loop, sem ficar chutando.
