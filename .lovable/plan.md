

## Plano: Trocar credenciais para o Supabase self-hosted

### Valores recebidos
- **URL:** `https://api.influlab.pro`
- **ANON_KEY:** `eyJhbGc...GzXz2mXN9` (role: anon)
- **SERVICE_ROLE_KEY:** `eyJhbGc...GzXz2mXN9` (role: service_role)

### Arquivos que vou alterar

**1. `.env`**
```
VITE_SUPABASE_PROJECT_ID="default"
VITE_SUPABASE_PUBLISHABLE_KEY="<nova ANON_KEY>"
VITE_SUPABASE_URL="https://api.influlab.pro"
```

**2. `src/integrations/supabase/client.ts`**
Trocar as constantes `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` pelos novos valores.

**3. `supabase/config.toml`**
Atualizar `project_id = "default"` (padrão do self-hosted).

### Secrets a atualizar (via tool de secrets)
Os 4 secrets do Supabase já existem no projeto Lovable, mas apontam pro Cloud antigo. Vou pedir atualização para:
- `SUPABASE_URL` → `https://api.influlab.pro`
- `SUPABASE_ANON_KEY` → nova ANON_KEY
- `SUPABASE_PUBLISHABLE_KEY` → nova ANON_KEY (mesmo valor)
- `SUPABASE_SERVICE_ROLE_KEY` → nova SERVICE_ROLE_KEY
- `SUPABASE_DB_URL` → vou pedir a connection string Postgres do self-hosted (formato `postgresql://postgres:<senha>@<host>:5432/postgres`)

Os outros secrets (`ASAAS_API_KEY`, `GOOGLE_GEMINI_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `LOVABLE_API_KEY`) permanecem inalterados.

### Avisos críticos

1. **`src/integrations/supabase/types.ts` não pode ser editado manualmente** — é gerado automaticamente. Após trocar a URL, o tipo pode ficar desatualizado se o schema do self-hosted divergir. Você precisará rodar `supabase gen types` localmente apontando pro self-hosted e colar o resultado, OU garantir que o schema do self-hosted seja idêntico ao do Cloud (mesmas tabelas/colunas).

2. **Migrations** — todas as migrations em `supabase/migrations/` precisam ter sido executadas no banco do self-hosted antes da troca, senão o app vai quebrar (tabelas não existem).

3. **Edge Functions continuam no Lovable Cloud** — após a troca, o frontend fala com `api.influlab.pro` (auth/db/storage), mas as edge functions continuam deployadas em `gchncrlrmsyzumgmbplh.supabase.co`. Elas vão usar os secrets atualizados (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) para escrever no banco do self-hosted via REST. Isso funciona, mas adiciona latência (function no Cloud → REST chamando self-hosted).

4. **`auth-email-hook`** está configurado em `supabase/config.toml` com `verify_jwt = false`. No self-hosted você precisa registrar o webhook de email manualmente apontando pra URL da function no Lovable Cloud: `https://gchncrlrmsyzumgmbplh.supabase.co/functions/v1/auth-email-hook`.

5. **Usuários e dados existentes no Cloud antigo NÃO serão migrados automaticamente** — você precisa fazer dump/restore do Postgres se quiser preservar.

### Pré-requisitos antes de aplicar

- [ ] Confirmar que `https://api.influlab.pro/rest/v1/` responde JSON (não HTML)
- [ ] Confirmar que todas as migrations foram aplicadas no self-hosted
- [ ] Decidir se vai migrar dados de usuários do Cloud antigo (separado)
- [ ] Ter a senha do Postgres do self-hosted em mãos para `SUPABASE_DB_URL`

### Ordem de execução (após aprovação)

1. Atualizar `.env`, `client.ts`, `config.toml` com os 3 novos valores
2. Solicitar atualização dos 5 secrets (URL, ANON, PUBLISHABLE, SERVICE_ROLE, DB_URL)
3. Aguardar você confirmar e me passar a `SUPABASE_DB_URL`
4. Rebuild do preview → testar login na nova base

