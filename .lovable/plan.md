## Objetivo

Garantir que o "Hype do dia" **nunca fique vazio**, mesmo quando Reddit/YouTube/Google Trends falham individualmente. Hoje a função só retorna erro quando **as 3 fontes** retornam `[]` ao mesmo tempo — o que provavelmente está acontecendo agora.

## Diagnóstico (antes de mexer em código)

Rodar no Studio self-hosted (`api.influlab.pro`):

```sql
-- 1) Tem dado bruto de hoje?
SELECT date, source, jsonb_array_length(trends) AS n, created_at
FROM daily_hype_raw
WHERE date >= CURRENT_DATE - 2
ORDER BY date DESC, source;

-- 2) Último job de hype falhou com qual mensagem?
SELECT id, status, error_message, model_used, attempts, created_at, completed_at
FROM ai_jobs
WHERE job_type = 'hype'
ORDER BY created_at DESC
LIMIT 5;
```

E no docker da VPS:
```bash
docker logs supabase-edge-functions --since 30m 2>&1 | grep -E "hype-sources|start-hype-job|fetch-daily-hype"
```

Isso vai mostrar quais fontes estão devolvendo 0 e por quê (403, 429, timeout, quota).

## Mudanças no código

### 1. Novas fontes (sem UOL/G1, sem Reddit)

Em `supabase/functions/_shared/hype-sources.ts`, adicionar:

- **`fetchGoogleTrendsRealtimeBR()`** — endpoint alternativo `https://trends.google.com/trends/api/dailytrends?hl=pt-BR&tz=180&geo=BR` (JSON com prefixo `)]}',` que precisa ser strippado). Mais estável e detalhado que o RSS atual.
- **`fetchYouTubeShortsBR(apiKey)`** — `youtube.search.list` com `q="#shorts"`, `regionCode=BR`, `order=viewCount`, `publishedAfter=últimas 24h`. Foco em conteúdo de criador (não só vídeo trending genérico).
- **`fetchYouTubeMusicTrendingBR(apiKey)`** — `videos.list?chart=mostPopular&videoCategoryId=10&regionCode=BR` (música/áudios virais — gold pra Reels/TikTok).

### 2. Reddit fica como fonte best-effort

Mantém, mas com log claro quando devolve 403 e **sem contar contra o threshold mínimo** (sabemos que IP de datacenter quase sempre é bloqueado).

### 3. Threshold + fallback evergreen via Gemini

Em `start-hype-job/index.ts`:
- Coleta em paralelo: Google Trends RSS + Google Trends Realtime + YouTube Trending + YouTube Shorts + YouTube Music + Reddit (opcional).
- Se `allTrends.length >= 5` → segue normal (gera 5 hypes personalizados).
- Se `allTrends.length === 0` → **em vez de erro**, Gemini gera 5 temas evergreen do nicho com `__meta.degraded = true`. Usuário nunca vê tela vazia.

### 4. Front (`HypeOfTheDay.tsx`)

Sem mudança estrutural. Como o backend não retorna mais erro, a mensagem "sem tendências" só aparece se a chamada do job falhar de rede/auth.

### 5. Rotacionar `YOUTUBE_API_KEY` (se logs apontarem)

Se aparecer `youtube status 403` ou `400` nos logs:
1. Nova key em https://console.cloud.google.com/apis/credentials
2. Restringir à API "YouTube Data API v3"
3. Atualizar `~/supabase/docker/.env` na VPS + `docker compose up -d --force-recreate functions`

## Arquivos alterados

- `supabase/functions/_shared/hype-sources.ts` — adicionar `fetchGoogleTrendsRealtimeBR`, `fetchYouTubeShortsBR`, `fetchYouTubeMusicTrendingBR`.
- `supabase/functions/start-hype-job/index.ts` — coletar das novas fontes, fallback evergreen quando 0.
- `supabase/functions/fetch-daily-hype/index.ts` — incluir novas fontes no cron diário.

## Bloco copia-e-cola pra VPS (depois do merge)

```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh
```

Forçar refresh manual do cache:
```bash
curl -X POST https://api.influlab.pro/functions/v1/fetch-daily-hype \
  -H "x-cron-secret: $CRON_SECRET"
```

## Validação

1. SQL #1 acima → esperar várias rows com `n > 0` pra hoje.
2. Limpar cache do seu user pra forçar regeneração:
   ```sql
   DELETE FROM user_daily_hype WHERE date = CURRENT_DATE;
   ```
3. Recarregar Hype do dia no app → 5 itens em <30s.