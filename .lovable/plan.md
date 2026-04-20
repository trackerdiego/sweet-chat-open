
Boa! Issue resolvida — secrets do Gemini agora estão injetados no container `supabase-edge-functions` do self-hosted e todas as 7 functions de IA voltaram ao ar.

Vou salvar uma memória core de troubleshooting pra próxima vez ir direto ao ponto sem 10 mensagens de diagnóstico.

## O que vou registrar

**Atualizar `mem://infra/backend-selfhosted`** adicionando seção de troubleshooting de secrets:

- Secrets do painel Lovable/Supabase Cloud NÃO chegam no self-hosted `api.influlab.pro`.
- Pra adicionar secret novo no self-hosted exige 2 edits + 1 restart:
  1. `~/supabase/docker/.env` → `NOME_SECRET=valor`
  2. `~/supabase/docker/docker-compose.yml` → no `environment:` do service `functions` (linha ~460): `NOME_SECRET: ${NOME_SECRET}`
  3. `cd ~/supabase/docker && docker compose up -d --force-recreate functions`
- Validar: `docker exec supabase-edge-functions env | grep NOME_SECRET`
- Quando function de IA falhar com 500, primeiro check é `docker logs supabase-edge-functions --tail 50` — `is not configured` no log = secret não injetado.

**Atualizar `mem://index.md`** Core: reforçar "secrets de edge functions exigem edit no docker-compose.yml + restart, não basta `.env`".

Sem mudança de código no app.
