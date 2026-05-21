
## Problemas identificados

1. **Regenera a cada refresh** — `start-hype-job` só grava em `user_daily_hype` quando NÃO está em modo `degraded`. Quando as fontes falham (ou retornam vazio), evergreen é gerado mas nunca cacheado → toda visita ao painel dispara Gemini de novo. Também não há proteção contra clique repetido no botão refresh.

2. **Conteúdo fora do nicho / política** — o prompt diz "descarte política" mas:
   - Os 60 itens enviados ao Gemini não são pré-filtrados, então política/tragédia/esporte entram no contexto e contaminam a saída.
   - Não há lista de bloqueio explícita (eleição, presidente, STF, guerra, morre, etc.).
   - Faltam exemplos de "o que SIM" (memes, virais leves, cultura pop, trends de áudio).

3. **Falta de viés pra memes/shorts** — fontes já incluem YouTube Shorts + Music, mas o prompt trata tudo igual. Não há instrução clara de priorizar formato meme/viral/áudio/desafio.

## Mudanças propostas (apenas `supabase/functions/start-hype-job/index.ts`)

### A) Cache sempre, inclusive evergreen
- Remover o `if (!degraded)` antes do `upsert` em `user_daily_hype`.
- Resultado: 1 geração por dia por usuário, sem exceção. Botão "refresh" no front continua podendo forçar nova chamada (já tem `force=true` no hook), mas refresh de página não regenera mais.

### B) Pré-filtro server-side de tendências ruins
Antes de montar `compact`, filtrar `allTrends` removendo títulos que casem (case-insensitive) com um blocklist:
```
política, eleição, eleições, presidente, lula, bolsonaro, stf, congresso,
ministro, senador, deputado, governo, guerra, israel, palestina, ucrânia,
russia, atentado, morre, morreu, falece, tragédia, acidente, assassinato,
crime, polícia, facção, futebol, libertadores, brasileirão, copa, seleção
```
Se sobrar < 10 itens depois do filtro, considera degraded e cai no evergreen (que agora é cacheado).

### C) Reescrever prompt com foco em meme/viral/cultura pop
- Trocar o "REGRAS" pra um bloco "FOCO" que prioriza:
  - **Memes brasileiros do momento** (frases virais, áudios do TikTok, edits)
  - **Cultura pop leve** (novelas, realities, BBB, música nova, lançamentos)
  - **Trends de formato** (desafios, transições, "POV", "que dia é hoje")
  - **Curiosidades virais** (coisas que viralizaram organicamente)
- Reforçar PROIBIDO: "qualquer assunto político, eleitoral, religioso polêmico, tragédia, morte, crime, guerra, esporte sério, economia/bolsa".
- Pedir que o `formato_sugerido` priorize `Reels` e `TikTok` (formatos curtos de meme), `Carrossel` só pra lista/dica.
- Adicionar campo implícito: o `gancho` deve soar como meme/abertura viral, não como reportagem.

### D) Skew nas fontes pesadas em meme
Em `compact`, dar peso extra (boost no score) pra `subsource = shorts` e `subsource = music`, garantindo que apareçam mais no top-60 enviado ao Gemini.

### E) Guard anti-spam no front (opcional, baixo custo)
Em `useDailyHype.reload`, ignorar cliques se faz menos de 30s do último reload, evitando que o usuário queime cota sem querer.

## Fora de escopo

- Tabela `user_daily_hype` continua com PK `(user_id, date)`, sem mudança de schema.
- Não mexer em outras edge functions, no front (exceto guard opcional do reload) ou no design.
- Sem migração SQL.

## Verificação

- Após deploy: abrir painel, ver itens; recarregar página 3x → não deve disparar Gemini de novo (checar log `start-hype-job`, não deve aparecer "live counts" nem "modelUsed").
- Inspecionar `user_daily_hype` do dia: linha existe mesmo se as fontes tiverem falhado (evergreen cacheado).
- Conferir 5 itens: nenhum deve tocar política/tragédia; pelo menos 2-3 devem ser claramente meme/áudio/trend de formato.

## Deploy

```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh start-hype-job
```
