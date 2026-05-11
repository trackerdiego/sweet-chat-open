## Diagnóstico

Os títulos "Dia X — OBJEÇÕES • Principal", "PECADOS", "ESPERANÇA" + hook quebrado ("Se você trabalha com Sou Diego possuo uma loja de roupas...") **não são bug de UI**. São o **fallback local** (`buildLocalStrategy` em `start-onboarding-run/index.ts`) que é usado quando a chamada à Gemini de uma semana inteira falha (timeout, parse JSON, ou rate-limit).

A matriz é gerada em 4 chamadas paralelas, uma por semana:
- Semana 1 (dias 1-7): OBJEÇÕES e FRUSTRAÇÕES
- Semana 2 (dias 8-14): FERIDAS e VERGONHA
- Semana 3 (dias 15-21): PECADOS e DESEJOS
- Semana 4 (dias 22-30): ESPERANÇA e DECISÃO

No seu caso, **as semanas 1, 3 e 4 falharam** (provavelmente timeout de 40s na Gemini paralela) e caíram no fallback. Semana 2 deu certo (Dia 12 "Redescobrindo o Tempo" tem hook coerente). O código aceita o resultado misto sem avisar e marca `onboarding_completed=true`.

**Sim, "Redefinir matriz" vai resolver** — dispara o pipeline inteiro de novo e quase certamente as 4 semanas vão entrar (a falha foi pontual, primeira ocorrência).

## Plano de correção (sem alterar UX)

### 1. Endurecer a geração da matriz em `start-onboarding-run/index.ts`
- Aumentar `primaryAttempts: 2` e `fallbackAttempts: 2` por semana (hoje é 1+1).
- Aumentar `timeoutMs` de 40s → 60s (a função tem ~150s de waitUntil, sobra folga).
- Trocar `Promise.allSettled` paralelo por **sequencial com pequeno delay**: parallel + Gemini 2.5-flash explode rate-limit do projeto self-hosted; sequencial entrega 100% mais previsível.

### 2. Detectar matriz "suja" e marcar para retry automático
- Após o loop, contar quantos dias têm título com prefixo "Dia X — OBJEÇÕES •" / "PECADOS •" / "ESPERANÇA •" / "FERIDAS •" (assinatura do fallback local).
- Se ≥1 semana caiu em fallback (`aiOk < 4`), salvar a matriz mesmo assim (pra não bloquear acesso) **mas** gravar `user_strategies.needs_regeneration = true` (coluna nova) e disparar uma re-geração em background **só das semanas faltantes**.
- Próximo poll do frontend mostra a matriz boa quando vier.

### 3. Botão "Redefinir matriz" — manter como está
- Já funciona pro seu caso atual. Use ele agora pra arrumar a matriz dessa conta.
- A correção #1+#2 evita que o problema volte pra próximos usuários.

### 4. SQL de auditoria/limpeza (self-hosted)
SQL pra rodar AGORA no Studio `https://studio.influlab.pro` resetando essa conta antes de você apertar "Redefinir matriz" (garantia extra que nenhum run antigo vai re-escrever lixo):

```sql
-- 1) ver run que produziu a matriz suja
select id, status, current_stage, error_message, completed_at,
       (stages -> 3 ->> 'source') as matrix_source
from public.onboarding_runs
where user_id = (select id from auth.users where email = 'agentevendeagente@gmail.com')
order by created_at desc limit 5;

-- 2) marcar runs antigos como falhos (impede re-escrita)
update public.onboarding_runs
   set status = 'failed', completed_at = coalesce(completed_at, now())
 where user_id = (select id from auth.users where email = 'agentevendeagente@gmail.com')
   and status in ('pending','running');
```

Depois disso é só apertar "Redefinir matriz" no app.

## Arquivos previstos

- `supabase/functions/start-onboarding-run/index.ts` (timeouts, retries, sequencial, detecção de fallback)
- `supabase/migrations/...` (coluna `user_strategies.needs_regeneration boolean default false` — opcional, só se você quiser o re-try automático da etapa 2)

## Resultado esperado

- Apertar "Redefinir matriz" agora → matriz nova com hooks específicos, sem títulos genéricos "OBJEÇÕES/PECADOS/ESPERANÇA".
- Próximas gerações: 4 semanas geradas sequencialmente com 2 tentativas cada → praticamente impossível cair em fallback nas 4 semanas ao mesmo tempo.
- Se ainda assim alguma semana falhar, sistema re-tenta sozinho em background ao invés de entregar matriz suja como definitiva.

## Pergunta antes de implementar

Você quer que eu implemente os 4 pontos, ou só os pontos 1 e 4 (endurecer geração + SQL pra essa conta) — sem mexer em schema novo do ponto 2?
