

User já adicionou os secrets no `.env` do Docker e (provavelmente) reiniciou. Mas ainda vê erros. Preciso confirmar se o restart pegou de fato e se o problema agora é outro.

## Plano

### 1. Diagnóstico rápido (modo default)
- `curl` no `ai-chat` em `api.influlab.pro` com auth válido → ver se ainda retorna `GOOGLE_GEMINI_API_KEY is not configured` ou erro novo
- `curl` no `admin-dashboard` com auth do email admin → ver se retorna 200 ou 401
- Verificar resposta exata do servidor self-hosted (não dos logs do Lovable Cloud, que não refletem o self-hosted)

### 2. Cenários possíveis

**A) Restart não pegou os novos secrets:**
- Você precisa rodar no servidor:
  ```bash
  cd /caminho/do/supabase
  docker compose down functions
  docker compose up -d functions
  # OU mais radical:
  docker compose restart
  ```
- `restart` simples às vezes não recarrega `.env` — `down` + `up` força.

**B) Secrets foram colocados no `.env` errado:**
- Self-hosted Supabase tem 2 `.env` possíveis: o do `docker-compose` (raiz) e o de cada serviço
- Pra edge functions, precisa estar no `.env` da raiz E referenciado em `docker-compose.yml` na seção `functions.environment`

**C) Admin panel: problema separado:**
- Se o `useUserProfile` carrega o email mas o `isAdmin` continua false, é bug de comparação de string ou cache do localStorage
- Vou checar `src/hooks/useUserProfile.ts` e onde o admin nav é renderizado

### 3. Ação
- Rodo os 2 curls
- Leio o código do admin gate
- Te entrego: status real do servidor + comando SSH exato pra forçar reload + fix de admin se for bug de código

Sem mexer em arquivo nesta rodada — só confirmar onde tá travado.

