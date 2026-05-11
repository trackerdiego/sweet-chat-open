## Diagnóstico

A matriz veio com o nicho antigo (marketing digital) mesmo você tendo descrito "loja de roupas" porque um **worker antigo continuou rodando em background** e sobrescreveu seus dados novos com os do payload anterior.

Reconstruindo o que aconteceu:

1. Tentativa anterior (marketing digital) → criou um `onboarding_runs` com `input_payload = "marketing digital"`, gravou o worker em `EdgeRuntime.waitUntil`, mas algo travou no meio (você relatou erros) e o `runId` ficou salvo em `localStorage` como pending/running.
2. Você reabriu o onboarding e descreveu "loja de roupas".
3. O `useEffect` de mount chamou `resume()`, viu o runId antigo no localStorage com status pending/running e voltou a fazer polling dele — o worker antigo terminou usando o **input_payload antigo** (marketing digital) e fez upsert em `audience_profiles` + `user_strategies` + `user_profiles.onboarding_completed=true`.
4. Mesmo que você tenha clicado "Começar" e disparado um run novo (loja de roupas), o worker antigo ainda estava vivo e re-escreveu por cima depois.

A salvaguarda existente (`if cur?.status === 'failed' skip writes`) só está na etapa 4 (matrix) e só dispara se ALGUÉM marcar o run antigo como failed — coisa que ninguém faz hoje quando o usuário recomeça.

## Plano

### 1. Cancelar runs anteriores ao iniciar um novo (`start-onboarding-run/index.ts`)
Antes de criar o novo `onboarding_runs`, marcar **todos** os runs `pending`/`running` desse `user_id` como `failed` com `error_message='superseded by new run'`. Isso garante que workers antigos vivos batam no guard de cancelamento e parem de escrever.

### 2. Estender o guard de cancelamento para TODAS as etapas (não só matrix)
No início de cada etapa (profile, audience, visceral, matrix), reler `onboarding_runs.status`. Se for `failed`, abortar imediatamente sem fazer upsert. Hoje só a etapa 4 checa — etapas 1–3 sobrescrevem `user_profiles`, `audience_profiles` mesmo após cancelamento.

### 3. Não retomar runs antigos quando o usuário está claramente recomeçando (`Onboarding.tsx`)
Hoje o `useEffect` chama `resume()` cego. Adicionar regra: só retomar se `profile.onboarding_completed === false` E o run no localStorage tiver `created_at` recente (ex.: < 30 min). Caso contrário, limpar o `localStorage` e ignorar.

### 4. Limpar dados velhos antes do worker novo gravar
No worker novo, antes da etapa 4 (matrix) gravar `user_strategies`, deletar a linha existente desse `user_id` e inserir do zero (em vez de upsert) — assim, mesmo que algum worker zumbi tenha gravado antes, ele é apagado.

### 5. SQL pro VPS (Studio self-hosted) — corrigir SEU caso agora
Limpar manualmente seus dados travados:
```sql
-- Cancela runs órfãos
update public.onboarding_runs
   set status='failed', error_message='manual cleanup', completed_at=now()
 where user_id = (select id from auth.users where email='SEU_EMAIL') 
   and status in ('pending','running');

-- Apaga matriz e perfil de público antigos
delete from public.user_strategies where user_id = (select id from auth.users where email='SEU_EMAIL');
delete from public.audience_profiles where user_id = (select id from auth.users where email='SEU_EMAIL');

-- Reseta onboarding pra você refazer limpo
update public.user_profiles 
   set onboarding_completed=false, description_status='pending', primary_niche='lifestyle'
 where user_id = (select id from auth.users where email='SEU_EMAIL');
```
+ no DevTools do app: `localStorage.removeItem('influlab.onboardingRunId')` antes de refazer.

### 6. Deploy
```bash
ssh root@VPS
cd /root/app && git pull
./scripts/deploy-selfhost.sh start-onboarding-run
```

## Resumo técnico

| Camada | Mudança |
|---|---|
| `start-onboarding-run/index.ts` | Cancela runs ativos antigos antes de criar novo; check de `status==='failed'` no início de cada etapa; delete-then-insert em `user_strategies` |
| `src/pages/Onboarding.tsx` | `resume()` só se onboarding incompleto + run recente |
| SQL manual | Limpa seu user pra rodar limpo agora |

Não toca em prompts da Gemini, pillars ou schema da matriz — o problema não é geração, é contaminação cruzada de runs.
