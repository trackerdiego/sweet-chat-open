
## Status atual (confirmado pelos prints)

- Cron corrigido: `scheduled-push-morning` (12h UTC) + `scheduled-push-evening` (23h UTC) + `cleanup-push-send-log-daily` ✅
- Volume real 7d: user A = 15, user B = 15, user C = 8 → média **~2 pushes/user/dia** — bate com o combinado ✅
- 3 users subscritos no total

Falta **só o PASSO C** do plano anterior: endurecer o código pra o dedup ser fail-safe mesmo se um dia o cron voltar a rodar louco.

## Único patch a aplicar

Arquivo: `supabase/functions/scheduled-push/index.ts`

**Mudança**: inverter a ordem entre "gravar no log" e "enviar push".

Hoje (bugado em caso de retry/duplicado):
1. Chama `send-push`
2. Se retornou `sent > 0`, insere em `push_send_log`

Depois:
1. Tenta `INSERT ... ON CONFLICT (user_id, send_date, block) DO NOTHING RETURNING user_id`
2. Se o INSERT retornou linha (ganhou a corrida), chama `send-push`
3. Se não retornou (já existe), pula silenciosamente

Vantagem: mesmo se o cron for reativado em `*/15 * * * *` por acidente, **cada user recebe no máximo 2 pushes/dia**, garantido no nível de banco. Hoje isso depende da ordem de execução — se `send-push` demorar, dois ticks podem enviar antes do primeiro log gravar.

Também vou:
- Trocar `.select('user_id')` sem limite por `.select('user_id').limit(10000)` explícito (defensivo — hoje o default PostgREST é 1000 e você silenciosamente perderia usuários se passar disso).
- Melhorar o log final pra distinguir `skipped_dedup` vs `skipped_conflict`.

## Fora de escopo

- Não mexo em `notify-pix-due-soon` agora (você não chegou a mencionar como problema; se quiser posso adicionar dedup depois).
- Não mexo em conteúdo das 4 mensagens.
- Não mexo em cron (já ajustado).

## Deploy

Depois do commit você roda no VPS:
```bash
cd /root/app && git pull && ./scripts/deploy-selfhost.sh scheduled-push
```

Aprovando, aplico o patch em seguida.
