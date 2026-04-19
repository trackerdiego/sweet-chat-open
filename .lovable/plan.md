
User quer:
1. Memória persistente que registra: backend é **self-hosted `api.influlab.pro`**, não o projeto Lovable. Migrations da Lovable não chegam lá. Toda mudança de dados/schema premium precisa ser feita manualmente via SQL no painel self-hosted.
2. Esclarecer/corrigir a questão da `UNIQUE(user_id)` na `user_usage` no self-hosted (que faltava e causou o erro `ON CONFLICT`).

Plano:

## 1. Salvar memória do backend self-hosted

Criar `mem://infra/backend-selfhosted` com regra clara:
- App roda contra `https://api.influlab.pro` (Supabase self-hosted), não contra o projeto Lovable `gchncrlrmsyzumgmbplh`.
- `src/integrations/supabase/client.ts` é hardcoded de propósito apontando pro self-hosted.
- Migrations criadas no Lovable **não** afetam o banco real do app.
- Para qualquer mudança de dados (premium, fixes, seeds) ou schema (constraints, colunas), gerar SQL pro user rodar manualmente no SQL Editor do self-hosted.
- Edge functions são deployadas via `scripts/deploy-selfhost.sh`.

Atualizar `mem://index.md` adicionando essa regra no Core (universal, aplica em toda ação) e referência na lista.

## 2. Corrigir schema do self-hosted (UNIQUE user_id)

Sim, **deveria** ter `UNIQUE(user_id)` no `user_usage` do self-hosted — o projeto Lovable tem, mas o self-hosted ficou sem. Mesmo problema pode existir em outras tabelas com 1 linha por user. Entregar SQL pro user rodar no painel self-hosted:

```sql
-- Limpa duplicatas em user_usage mantendo a mais recente
DELETE FROM public.user_usage a
USING public.user_usage b
WHERE a.user_id = b.user_id
  AND a.created_at < b.created_at;

ALTER TABLE public.user_usage
ADD CONSTRAINT user_usage_user_id_unique UNIQUE (user_id);

-- Mesmo tratamento preventivo nas demais tabelas 1-por-user
ALTER TABLE public.user_progress
ADD CONSTRAINT user_progress_user_id_unique UNIQUE (user_id);

ALTER TABLE public.user_strategies
ADD CONSTRAINT user_strategies_user_id_unique UNIQUE (user_id);

ALTER TABLE public.audience_profiles
ADD CONSTRAINT audience_profiles_user_id_unique UNIQUE (user_id);

ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);
```

Se alguma dessas tiver duplicatas também, rodar `DELETE` análogo antes do `ALTER`.

Depois disso, futuros UPSERTs com `ON CONFLICT (user_id)` funcionam direto, sem o fallback UPDATE+INSERT.

## Resultado

- Memória garante que eu nunca mais vou tentar rodar migration esperando que afete o app real.
- Schema do self-hosted fica consistente com o do Lovable, evitando o erro `42P10` no futuro.

Sem mudança de código no frontend.
