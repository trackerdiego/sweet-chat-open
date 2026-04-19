

## Plano: Caminho B — Deploy via Studio do self-hosted

Você escolheu colar o código das 14 functions manualmente no Studio. Plano pra facilitar isso.

### Como funciona no Studio do self-hosted

1. Acesse o Studio do seu self-hosted (geralmente `https://api.influlab.pro` ou subdomínio tipo `studio.influlab.pro` — se não souber qual, me avisa)
2. Menu lateral → **Edge Functions** → **Create a new function**
3. Cole o nome exato da function e o conteúdo do `index.ts`
4. Salvar → o Studio empacota e deploya automaticamente

### O que vou criar aqui no Lovable pra te ajudar

Um arquivo único **`MIGRATION-FUNCTIONS.md`** na raiz do projeto contendo:

1. **Checklist das 14 functions** com nome exato + flag `verify_jwt` correta:
   - `verify_jwt = false`: `auth-email-hook`, `asaas-webhook`, `scheduled-push`, `process-email-queue`, `send-push`
   - `verify_jwt = true` (padrão): as outras 9
2. **Lista de secrets** que você precisa configurar antes (no Studio → Edge Functions → Secrets):
   - `GOOGLE_GEMINI_API_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `LOVABLE_API_KEY`
   - (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` são automáticos)
3. **Ordem recomendada de deploy** (mais simples → mais complexas), pra você testar incrementalmente
4. **Comandos curl de teste** pra cada function depois do deploy
5. **Configurações pós-deploy**:
   - URL do webhook Asaas
   - URL do auth email hook no painel Auth
   - SQL dos cron jobs (`scheduled-push` 15min, `process-email-queue` 1min)
6. **Troubleshooting comum** (function não aparece, erro de import, CORS, etc.)

### O que NÃO vou alterar

- Código das functions (já está pronto, só copy/paste)
- `client.ts` (já aponta pro `api.influlab.pro`)
- `.env` (já atualizado)

### Risco principal

Se o Studio do seu self-hosted **não tiver** a aba Edge Functions com editor (versões antigas não têm), Caminho B não funciona e vai ter que ser SSH (Caminho A). Confirma no Studio se a opção existe antes de comprometer com esse caminho. Se não tiver, me avisa que mudo o plano.

