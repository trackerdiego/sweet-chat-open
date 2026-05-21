# Corrigir hype: bloco duplicado quebra a função

## Diagnóstico

A função `start-hype-job/index.ts` tem o trecho de "Perfil do user" **duplicado** (linhas 91–99 e 108–116). Isso declara `profile`, `audience`, `niche`, `style`, `ap` duas vezes no mesmo escopo, e o Deno aborta com `SyntaxError: Identifier 'profile' has already been declared`. Resultado: TODA chamada de gerar hype falha com erro — não importa se as fontes (Google Trends / YouTube / Reddit) trouxeram dados ou não. As trends provavelmente até estão sendo coletadas, mas a função morre antes de chamar o Gemini.

Não é problema das fontes, nem de cache, nem do Gemini — é puramente o código duplicado introduzido na última edição.

## Mudança

Arquivo: `supabase/functions/start-hype-job/index.ts`

Remover a segunda ocorrência do bloco (linhas 108–116), mantendo apenas a primeira (91–99) que já está posicionada antes do `compact` (que usa `allTrends`, não depende do perfil) — a ordem fica correta.

Resultado final dessa região:

```text
... fetch das trends ...
const degraded = allTrends.length === 0;

// 3) Perfil do user pra personalizar  (UMA vez só)
const [{ data: profile }, { data: audience }] = await Promise.all([...]);
const niche = profile?.primary_niche || "lifestyle";
const style = profile?.content_style || "casual";
const ap = (audience?.avatar_profile ...) ?? {};

const compact = allTrends.sort(...).slice(0,60).map(...).join("\n");

const systemInstruction = `...usa niche, style, ap...`;
const prompt = degraded ? `...evergreen...` : `...compact...`;
... chamada Gemini ...
```

## Deploy (VPS self-hosted)

Como o backend roda em `api.influlab.pro` e migrations/edge functions do Lovable não chegam lá automaticamente, depois do merge no GitHub você roda na VPS:

```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh
```

(ou só `docker compose restart functions` se preferir).

## Verificação pós-deploy

1. Abrir o app, clicar em "Hype do dia" → deve gerar 5 itens (reais ou evergreen).
2. Conferir logs:
   ```bash
   docker logs supabase-edge-functions --since 5m | grep -E "start-hype-job|hype-sources"
   ```
3. Conferir no Studio self-hosted se as trends foram salvas:
   ```sql
   SELECT date, source, jsonb_array_length(trends) FROM daily_hype_raw WHERE date = CURRENT_DATE;
   SELECT id, status, error_message, attempts FROM ai_jobs WHERE job_type = 'hype' ORDER BY created_at DESC LIMIT 5;
   ```

Se ainda quiser forçar refresh: `SELECT * FROM user_daily_hype WHERE user_id = '<seu_id>' AND date = CURRENT_DATE;` e `DELETE` se necessário.
