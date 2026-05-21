## Hype do Dia — fontes gratuitas (sem Perplexity)

Mesma arquitetura assíncrona aprovada, só troco as fontes do `fetch-daily-hype` por APIs públicas grátis.

### Fontes (todas free, escalam pra milhares de users)

1. **Google Trends BR** — RSS público `https://trends.google.com/trending/rss?geo=BR`. Sem auth, sem quota. ~20 termos do dia com volume estimado e notícias relacionadas. **Base do feed.**
2. **Reddit** — endpoints JSON públicos sem auth:
   - `https://www.reddit.com/r/brasil/hot.json?limit=25`
   - `https://www.reddit.com/r/popular/hot.json?geo_filter=BR&limit=25`
   - Só precisa mandar `User-Agent` custom. Limit ~60 req/min por IP, sobra muito pra 1 call/dia.
3. **YouTube Trending BR** — YouTube Data API v3, `videos.list?chart=mostPopular&regionCode=BR&maxResults=25`. Free quota: **10.000 unidades/dia**, esse endpoint custa 1 unidade. 1 call/dia = 0,01% da cota. Precisa de `YOUTUBE_API_KEY` (gratuita no Google Cloud Console, 2 min pra criar).

Tudo isso roda **1x por dia** dentro de `fetch-daily-hype`, grava ~50-70 itens crus em `daily_hype_raw` (1 row por fonte). Custo de infra: zero.

### O que muda do plano anterior

| Componente | Antes | Agora |
|---|---|---|
| Fontes | Perplexity sonar pago | Google Trends RSS + Reddit JSON + YouTube Data API |
| Secret novo | `PERPLEXITY_API_KEY` | `YOUTUBE_API_KEY` (free) |
| Custo/dia em escala | ~$0,05 (acumula) | $0 fixo |
| Tabelas, jobs, frontend, cron | igual | igual |

O resto do plano (tabelas `daily_hype_raw` + `user_daily_hype`, `start-hype-job` com Gemini personalizando top 5, hook `useAiJob('hype')`, card no Dashboard, cache 24h) **continua idêntico** — só a fonte muda.

### Por que ainda é qualidade alta

Gemini Flash recebe ~50-70 trends crus (termo + categoria + de onde veio + breve contexto) + perfil do usuário e devolve os 5 mais relevantes pro nicho dele já com gancho pronto. A IA cobre o que falta de "explicação humana" que o Perplexity dava de graça antes.

### Setup mínimo do user (uma vez)

1. Google Cloud Console → criar projeto → ativar "YouTube Data API v3" → criar API key → restringir a essa API.
2. Adicionar `YOUTUBE_API_KEY` como secret na VPS (.env + docker-compose).

Sem isso, a function ainda funciona só com Google Trends + Reddit (degrada gracioso).

### Próximo passo

Se aprovar, eu já implemento: migration (tabelas), `fetch-daily-hype` (3 fontes), `start-hype-job` (Gemini), `HypeOfTheDay.tsx` + hook, e fecho com o bloco copy-paste pra rodar na VPS.