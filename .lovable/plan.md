

Usuário gerou keys novas e quer atualizar. Preciso pedir as keys de forma segura e clara.

**O que preciso receber:**
1. **JWT_SECRET** novo (idealmente gerado com `openssl rand -base64 48` localmente, NÃO em site online) — esse vai pro Easypanel apenas, não pro código
2. **ANON_KEY** nova (assinada com o JWT_SECRET acima) — vai pro `client.ts` e `.env`
3. **SERVICE_ROLE_KEY** nova — vai como secret no painel das edge functions do self-hosted, NÃO no chat idealmente

**Risco a reforçar:** se gerou de novo no mesmo site online, o problema persiste. JWT_SECRET precisa ser secreto.

## Plano de execução (quando aprovado)

**Etapa 1 — Validar antes de mudar código**
Rodar curl com a ANON_KEY nova contra `https://api.influlab.pro/rest/v1/user_profiles?limit=1` (com header `apikey` + `Authorization: Bearer`). 
- 200 → keys batem com JWT_SECRET do Easypanel ✅
- 401 "invalid signature" → JWT_SECRET no Easypanel não bate com o que assinou as keys ❌ (parar e re-sincronizar)

**Etapa 2 — Atualizar frontend**
- `src/integrations/supabase/client.ts` → trocar `SUPABASE_PUBLISHABLE_KEY` pela ANON_KEY nova
- `.env` → atualizar `VITE_SUPABASE_URL="https://api.influlab.pro"` e `VITE_SUPABASE_PUBLISHABLE_KEY="<nova_anon>"`

**Etapa 3 — Confirmar secrets no self-hosted**
Lembrar usuário que precisa atualizar no Studio do `api.influlab.pro` (não no Lovable Cloud):
- `SUPABASE_ANON_KEY` = nova anon
- `SUPABASE_SERVICE_ROLE_KEY` = nova service_role
- `SUPABASE_URL` = `https://api.influlab.pro`

**Etapa 4 — Smoke test**
Rodar bateria do `TESTE-CHECKLIST.md` etapas 1, 2, 3.2, 3.3 com curl direto.

## Como me passar as keys (importante)

- **ANON_KEY**: pode colar no chat (é pública por design)
- **SERVICE_ROLE_KEY**: NÃO cole no chat. Confirme só que cadastrou nos secrets do self-hosted
- **JWT_SECRET**: NUNCA cole. Só fica no Easypanel

## Pergunta antes de prosseguir

Onde você gerou o JWT_SECRET novo?

