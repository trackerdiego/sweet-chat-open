# Reduzir push pra 2/dia + 4 mensagens educativas rotativas

## O que muda

**1. Pausa imediata (kill switch)**
Adiciono `PUSH_PAUSED` no `scheduled-push`. Quando `true`, a function retorna `{ paused: true, sent: 0 }` sem tocar em `send-push`. Você liga/desliga editando `.env` + `docker compose up -d --force-recreate functions`. Já subo com `PUSH_PAUSED=true` — nenhum envio sai até você desativar.

**2. De 4 blocos/dia → 2 blocos/dia**
Hoje a function tem `morning / insight / afternoon / evening`. Vou reduzir pra só `morning` e `evening`. Isso já garante o máximo de 2/dia por usuário (a dedup em `push_send_log` por `(user_id, send_date, block)` continua igual).

Você também precisa **reduzir os disparos do cron** (é ele quem chama a function). Entrego no final o SQL/crontab pra rodar 2×/dia em vez de 4.

**3. 4 mensagens educativas rotativas (substituem TUDO)**
Apago os 7 segmentos atuais (PREMIUM / FREE_EARLY / FREE_TRIAL_END / FREE_LOCKED / FREE_EXHAUSTED / FREE_INACTIVE / NEW_USER) e todas as pools motivacionais/venda. No lugar, 4 mensagens fixas, cada uma explicando uma ferramenta do app:

- **Msg 1 — Tarefas diárias** (`/tarefas`)
  Título: `✅ Sua tarefa do dia tá pronta`
  Corpo: `Abre a aba Tarefas: 5 passos práticos personalizados pro seu nicho, feitos pra você executar em <30 min.`

- **Msg 2 — Chat de IA livre** (`/chat`)
  Título: `💬 Pergunta o que quiser pra IA`
  Corpo: `Chat livre no app: tira dúvida de roteiro, ideia, edição, algoritmo — responde sobre qualquer assunto de conteúdo.`

- **Msg 3 — Gerador de Roteiros** (`/roteiro`)
  Título: `🎬 Roteiro pronto em 30 segundos`
  Corpo: `Digita o tema, escolhe o formato (Reel/carrossel/story) e a IA monta hook + desenvolvimento + CTA. Testa hoje.`

- **Msg 4 — Ferramentas de IA** (`/ferramentas`)
  Título: `🧰 Hooks, legendas e CTAs prontos`
  Corpo: `Aba Ferramentas: gera hooks virais, legendas otimizadas e chamadas pra ação sob medida pro seu conteúdo.`

**4. Rotação determinística (nunca repete)**
Índice = `(diasDesde1970 * 2 + (block === 'evening' ? 1 : 0) + hash(user_id)) % 4`.
Efeito: cada usuário recebe as 4 mensagens em ordens diferentes, e nunca a mesma 2 sends seguidos. Sem randomização — dá pra reproduzir e debugar.

## Detalhes técnicos

Arquivo tocado: `supabase/functions/scheduled-push/index.ts` (rewrite; 529 → ~120 linhas). Sem migration — não mexo em `push_send_log` nem em `push_subscriptions`. `send-push` fica igual. `notify-pix-due-soon` fica igual (é fatura, não é push motivacional — não conta na regra de 2/dia).

Fluxo novo do `scheduled-push`:

```text
1. Se PUSH_PAUSED === 'true' → retorna paused, sai
2. Recebe body { block: 'morning' | 'evening' } (default: infere pelo horário BRT)
3. Busca user_ids únicos de push_subscriptions
4. Filtra os que já receberam hoje neste block (push_send_log)
5. Pra cada user restante:
   - message = MESSAGES[rotationIndex(userId, block)]
   - POST send-push
   - Se sent>0 → insert push_send_log
6. Retorna { block, sent, skipped }
```

Não uso mais `user_usage` nem `user_progress` (segmentação some).

## SQL/crontab pra rodar depois do deploy (no self-hosted)

**Pausar já (opcional — subo com flag ligada):** nada a fazer, já vem pausado.

**Ligar quando quiser:** editar `~/supabase/docker/.env`, trocar `PUSH_PAUSED=true` por `PUSH_PAUSED=false`, e `docker compose up -d --force-recreate functions`.

**Reduzir cron pra 2×/dia (9h e 20h BRT = 12h e 23h UTC):** entrego no chat pós-deploy o `cron.unschedule` dos jobs atuais + `cron.schedule` novo com 2 horários, ou o `crontab -e` equivalente se você usa cron da VPS. (Preciso saber qual dos dois é o seu setup — pergunto depois do deploy pra não travar aqui.)

## O que fica intocado

- `send-push` (motor de envio Web Push).
- `notify-pix-due-soon` (avisos de fatura Pix — não são push motivacional).
- Tabela `push_send_log` (dedup continua igual).
- Frontend (`usePushNotifications`, `PushNotificationButton`).
