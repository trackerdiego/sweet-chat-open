## Objetivo

Renovar todo o sistema de push notifications: rebrand pra **VyralLab**, mais diversidade/criatividade nas copies, novo bloco diário de **insight** + provas sociais, e ampliar a janela de lembrete de Pix pra incluir **D+1 (1 dia após vencer)** — só pra quem paga por Pix.

---

## 1. Rebrand: Influlab → VyralLab

Substituir em todos os pontos de copy enviada ao usuário:

- `supabase/functions/scheduled-push/index.ts` (3 ocorrências em NEW_USER e FREE_INACTIVE)
- `supabase/functions/notify-pix-due-soon/index.ts` (1 ocorrência)
- `supabase/functions/send-push/index.ts` → `mailto:push@influlab.app` vira `mailto:push@vyrallab.online` (campo `sub` do JWT VAPID, visível só pros push servers)
- `public/sw-push.js` → fallback title "Influlab" vira "VyralLab" (cache name `influlab-v1` fica — trocar invalidaria service workers instalados sem ganho)

---

## 2. Banco de copies expandido (mais diversidade)

Cada segmento ganha mais variações e tom mais variado (motivacional, estratégico, prova social, curiosidade, urgência leve). Meta: dobrar o pool atual (~6 por bloco) pra **~12 por bloco** em cada segmento, evitando repetição percebida em uma semana.

Categorias de tom misturadas em cada pool:

- **Motivacional** — "Você tá mais perto do que pensa…"
- **Estratégico/dica curta** — "Hook do dia: comece com uma pergunta que dói"
- **Prova social genérica** — "+340 creators aumentaram engajamento essa semana usando a matriz"
- **Curiosidade/cliffhanger** — "3 erros que matam alcance no Reels — abre pra ver"
- **CTA direto** — "Sua estratégia de hoje tá pronta. Bora?"

Provas sociais são **genéricas e atemporais** (sem números reais de DB nesta fase — números fixos plausíveis ou frases sem número tipo "centenas de creators…"). Marcar com comentário `// social-proof generic` pra futura troca por dados reais.

---

## 3. Novo bloco: **insight** (4º horário)

Adiciona um quarto envio diário focado em **um insight prático + CTA**, separado dos blocos morning/afternoon/evening.

```text
morning   ~ 08h BR   tom: energizar, abrir o dia
insight   ~ 13h BR   tom: 1 dica acionável + "abre o app pra aplicar"
afternoon ~ 16h BR   tom: cobrar execução
evening   ~ 20h BR   tom: fechar dia / planejar amanhã
```

**Estrutura do insight** (exemplos):
- Hook tip: "📝 Insight do dia: vídeo que não gera comentário não gera alcance. Abre o app e veja 5 hooks pro seu nicho."
- Storytelling tip: "🎬 Storytelling rápido: comece pelo fim. Mostre o resultado antes do processo."
- CTA tip: "🎯 CTA que converte: peça UMA ação. 'Salva esse post' funciona mais que 'curte e compartilha'."
- Algoritmo tip: "📈 Reels com retenção >70% nos primeiros 3 segundos têm 4x mais alcance."
- Prova social: "✨ +500 creators usaram a matriz essa semana. E você?"

Cada segmento (PREMIUM, FREE_EARLY, FREE_TRIAL_END, FREE_LOCKED, FREE_EXHAUSTED, FREE_INACTIVE, NEW_USER) ganha seu pool de insights, com CTA adequado (PREMIUM → `/tasks`, FREE_LOCKED → `/?upgrade=true`, etc.).

### Mudanças técnicas pra suportar o novo bloco

- `type Block = 'morning' | 'afternoon' | 'evening' | 'insight'`
- `getTimeBlock()` reconhece a faixa 12-14h BR como `insight` (mas continua aceitando override via `body.block` do cron)
- Cada record `PREMIUM`/`FREE_*`/`NEW_USER` ganha chave `insight`
- Tabela `push_send_log` já tem coluna `block text` — não precisa migração, só passa a aceitar o valor `'insight'`
- Cron VPS ganha 1 entrada nova: `0 13 * * *` chamando `scheduled-push` com `{"block":"insight"}` (entregar no bloco copia-e-cola do deploy)

---

## 4. Renovação Pix: adicionar **D+1** (1 dia após vencer)

`supabase/functions/notify-pix-due-soon/index.ts` hoje cobre D-3, D-1, D-0. Adicionar:

- **D+1** (1 dia depois do `due_date`): mensagem de urgência alta — "Sua assinatura venceu ontem. Pague em segundos pra recuperar acesso." → link `/renovar`
- Filtro continua: só `billing_type IN ('PIX','UNDEFINED')` (cartão recorrente nunca recebe)
- Idempotência: novo flag `d_plus_1: boolean` em `notifications_sent` dentro do JSON `next_invoice` (não precisa migração de schema, já é JSONB)
- Janela máxima: só dispara D+1 se `days === -1` (não fica enviando indefinidamente)

Copies (3-4 variações, escolha aleatória):

- "Sua assinatura venceu ontem 😬 — pague o Pix em segundos e recupera o acesso"
- "Acesso pausado: sua fatura venceu ontem. Toque pra regularizar"
- "Ainda dá tempo! Sua renovação venceu ontem — Pix expira logo, pague agora"

D-3, D-1, D-0 ganham 2-3 variações cada também (hoje é mensagem fixa).

---

## 5. Estrutura do código

Mantém o arquivo único `scheduled-push/index.ts` (sem refatorar pra módulos — Deno edge function self-hosted, simples é melhor). Apenas:

1. Move pools de copies pra constantes no topo, organizadas por `[segment][block]`
2. Helper `pick<T>(arr)` continua igual
3. Acrescenta validação: se o pool do `insight` estiver vazio pra um segmento, faz fallback pro pool `morning` daquele segmento

---

## Entregáveis

- Editado: `supabase/functions/scheduled-push/index.ts` (rebrand + pools expandidos + bloco insight)
- Editado: `supabase/functions/notify-pix-due-soon/index.ts` (D+1 + variações)
- Editado: `supabase/functions/send-push/index.ts` (mailto VAPID)
- Editado: `public/sw-push.js` (fallback title)
- Bloco copia-e-cola pra VPS no final: `cd /root/app && git pull && ./scripts/deploy-selfhost.sh scheduled-push send-push notify-pix-due-soon` + linha de crontab nova pro bloco insight (13h BR = 16h UTC)

---

## Fora de escopo (perguntar depois se quiser)

- Personalizar insight por nicho real do usuário via IA (caro, fica pra v2)
- Prova social com números reais do DB (precisa endpoint de stats)
- A/B test de copy (precisa coluna nova em `push_send_log`)
