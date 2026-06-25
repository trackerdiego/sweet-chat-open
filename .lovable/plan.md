## Persistir telefone do checkout no banco

### O que muda

1. **Schema (`user_profiles`)** — nova coluna `phone TEXT` (nullable, só dígitos). Index simples pra busca futura.
2. **Edge function `create-asaas-subscription`** — após criar/atualizar customer na Asaas com sucesso, faz `upsert` em `user_profiles.phone` usando o `user_id` autenticado.
3. **Frontend** — nenhuma mudança visual. O `CheckoutModal` já coleta o campo; só passa a persistir.

### Por que no edge function (e não no front)
- Garante que o número só é salvo quando o checkout realmente vai pra Asaas (não em rascunhos abandonados).
- Service role bypassa RLS de forma controlada.
- Evita confiar em chamada client-side extra.

### SQL pra rodar no Studio self-hosted (`api.influlab.pro`)
Como o backend é self-hosted, a migration Lovable **não chega no prod** — vou te entregar o bloco copia-e-cola no fim:

```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_phone
  ON public.user_profiles(phone)
  WHERE phone IS NOT NULL;
```

Também rodo a mesma migration no Supabase Lovable Cloud (pra `src/integrations/supabase/types.ts` ficar em sincronia e o TS não reclamar).

### LGPD / segurança
- Coluna nullable, opt-in implícito (só salva quem chega no checkout).
- RLS atual de `user_profiles` já restringe leitura ao próprio dono — telefone herda essa proteção.
- Sem log do número em console nem em `email_send_log`.

### Não incluso (não pedido)
- Não vou alterar Auth/Onboarding pra pedir telefone fora do checkout.
- Não vou criar campanha/disparo de WhatsApp — só persistência.

### Entregável final
Ao fim da execução, te mando:
- Resumo do que mudou no código.
- Bloco SQL pronto pra colar no Studio self-hosted.
- Lembrete de redeploy do edge function via `./scripts/deploy-selfhost.sh` (ou `docker compose restart functions`).

Pode aprovar?
