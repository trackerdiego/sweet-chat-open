

# Adicionar Secrets Faltantes (GOOGLE_GEMINI_API_KEY e ASAAS_API_KEY)

## Situação das VAPID Keys
As chaves VAPID **não são secrets** neste projeto — estão hardcoded no código:
- **Frontend**: `src/hooks/usePushNotifications.ts` linha 4
- **Backend**: `supabase/functions/send-push/index.ts` linhas 9-10

Ambas usam o mesmo par de chaves e já estão sincronizadas. Não há necessidade de adicioná-las como secrets.

## Secrets que Faltam
Os seguintes secrets precisam ser adicionados via ferramenta de secrets:

1. **GOOGLE_GEMINI_API_KEY** — `AIzaSyBQQ-_R49cUVy_p1K6lZ9UFCnxJZUzLoew`
   - Usada por: `generate-audience-profile`, `generate-daily-guide`, `generate-personalized-matrix`, `generate-script`, `generate-tools-content`

2. **ASAAS_API_KEY** — a chave que você forneceu anteriormente
   - Usada por: `create-asaas-subscription`

## Plano
1. Usar a ferramenta `add_secret` para adicionar `GOOGLE_GEMINI_API_KEY`
2. Usar a ferramenta `add_secret` para adicionar `ASAAS_API_KEY`

Isso completará a configuração e todas as Edge Functions poderão funcionar corretamente.

