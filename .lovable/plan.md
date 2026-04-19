

User quer que eu teste na prática a conexão com o self-hosted (`api.influlab.pro`). Mas tem um detalhe crítico que preciso explicar antes de prometer qualquer teste:

**Minhas ferramentas Supabase (`supabase--read_query`, `supabase--curl_edge_functions`, `supabase--analytics_query`, etc.) estão ligadas ao projeto Lovable Cloud original (`gchncrlrmsyzumgmbplh.supabase.co`), NÃO ao self-hosted.**

Evidência:
- `<supabase-info>` mostra project ref `gchncrlrmsyzumgmbplh`
- `.env` ainda tem `VITE_SUPABASE_URL="https://gchncrlrmsyzumgmbplh.supabase.co"` (apesar do `client.ts` apontar pro self-hosted)
- Secrets listados são do Lovable Cloud
- Não tenho credenciais nem ferramenta nativa pra falar com `api.influlab.pro`

O que EU consigo testar de verdade:
1. ✅ HTTP genérico contra `api.influlab.pro` via `code--exec curl` (qualquer endpoint público — health, signup, webhook fake)
2. ✅ Rodar todos os curls do `TESTE-CHECKLIST.md` etapas 1, 2, 3.2, 3.4 sem precisar de login
3. ❌ Queries SQL no banco self-hosted (não tenho psql apontando pra lá)
4. ❌ Functions autenticadas (precisaria de JWT de usuário real, posso pegar do signup do passo 2)

O que precisa do usuário:
- ANON_KEY do self-hosted (não tenho — a do `client.ts` parece placeholder/inválida: `iat:1713456000` é 2024-04 e `exp:2028` é round demais)
- Confirmação de quais functions já foram deployadas (pra não testar 404 desnecessário)

Plano: criar script `scripts/smoke-test-selfhost.sh` que roda tudo que dá pra rodar sem credencial extra, e pra etapas autenticadas usar o `access_token` retornado pelo próprio signup. Salvar resultados em `/tmp/smoke-results.txt`.

Mas antes de codar, preciso da ANON_KEY real e saber se já fez deploy das functions. Vou pedir.

