
Diagnóstico: `ai-chat` retorna 401 sem token = função existe e está deployada ✅. Logo o problema é runtime quando o user tenta usar (com token válido).

Hipóteses prováveis (em ordem):
1. **Secret `GOOGLE_GEMINI_API_KEY` não setado no self-hosted** → função entra no `throw new Error("GOOGLE_GEMINI_API_KEY is not configured")` → catch → retorna 500.
2. **Schema do `user_usage` no self-hosted sem colunas `chat_messages`/`last_chat_date`/`is_premium`** → erro Postgres → 500.
3. **Chave Gemini inválida ou sem billing** → 401/403 do Google → função retorna 500.
4. **`auth.getUser()` falha** porque self-hosted usa signing keys diferentes → retorna 401.

Sem ver o erro real que aparece no app eu chuto. Preciso de 1 dos 3 sinais abaixo pra cravar a causa em 1 mensagem.

## Plano (3 testes que o user roda — leva 1 min)

### Teste A — chamada autenticada via curl (mostra o erro real do Gemini/secret)

No terminal do servidor, com o JWT do user logado (pega no DevTools → Application → LocalStorage → `sb-...-auth-token` → `access_token`):

```bash
TOKEN="<cole-o-access_token-aqui>"
curl -i https://api.influlab.pro/functions/v1/ai-chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"oi"}]}'
```

Resultado esperado por causa:
- `500 {"error":"GOOGLE_GEMINI_API_KEY is not configured"}` → cenário 1
- `500 {"error":"Erro no serviço de IA"}` → cenário 3 (chave inválida/sem billing)
- `500 {"error":"column ... does not exist"}` ou similar → cenário 2 (schema)
- `401 {"error":"Unauthorized"}` → cenário 4 (signing keys)

### Teste B — confirmar que o secret está no self-hosted

No servidor onde roda o Supabase self-hosted:

```bash
docker exec supabase-edge-functions env | grep -i gemini
# OU, se usa supabase CLI linkado:
supabase secrets list --project-ref <REF_DO_SELF_HOSTED>
```

Se não aparecer `GOOGLE_GEMINI_API_KEY` → cenário 1 confirmado.

### Teste C — confirmar schema de `user_usage`

No SQL Editor do Studio self-hosted:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='user_usage'
ORDER BY column_name;
```

Tem que existir: `user_id`, `is_premium`, `chat_messages`, `last_chat_date`, `tools_used`, `last_tool_date`, `transcriptions_used`, `last_transcription_date`, `daily_guides_generated`, `last_guide_date`, `created_at`. Faltando alguma → cenário 2.

## Correções por cenário

### Se for cenário 1 (secret faltando) — mais provável
```bash
cd /caminho/do/projeto
export SUPABASE_ACCESS_TOKEN=<token-self-hosted>
export PROJECT_REF=<ref-self-hosted>
./scripts/deploy-selfhost.sh --secrets
# Ele vai pedir GOOGLE_GEMINI_API_KEY e ASAAS_API_KEY, e re-deploya tudo já com os secrets
```

### Se for cenário 3 (chave inválida)
Gera nova key em https://aistudio.google.com/apikey, garante billing ativo no Google Cloud, e roda o `--secrets` acima de novo passando a key nova.

### Se for cenário 2 (schema) — entrego SQL pronto
Depois de ver o output do teste C eu mando o `ALTER TABLE` exato adicionando só as colunas que faltam.

### Se for cenário 4 (signing keys / 401 com token válido)
Mexer em `auth.getUser()` → trocar por `auth.getClaims(token)` que é compatível com signing keys do self-hosted novo. Aplicar nas 9 functions privadas e re-deployar.

## Próximo passo
Roda **só o Teste A** primeiro (é o mais informativo) e cola aqui:
1. O status code (200/401/500)
2. O JSON do response

Com isso eu já mando a correção exata em 1 mensagem.
