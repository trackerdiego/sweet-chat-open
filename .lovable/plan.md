

# Corrigir Erros de Onboarding — Constraints Ausentes

## Problema

As tabelas `audience_profiles` e `user_strategies` nao tem constraint UNIQUE na coluna `user_id`. Quando as Edge Functions tentam fazer `upsert` com `onConflict: "user_id"`, o Postgres rejeita com erro `42P10`. O resultado: perfil de audiencia e matriz personalizada nunca sao salvos no banco.

## Causa Raiz

O clone do projeto nao copiou as constraints UNIQUE que existiam no Aura OS. As Edge Functions geram os dados corretamente (os logs mostram "Step 2 complete" com sucesso), mas falham ao salvar.

## Plano

### Migração SQL (unica ação necessária)

Adicionar constraints UNIQUE em `user_id` nas duas tabelas afetadas:

```sql
ALTER TABLE public.audience_profiles
  ADD CONSTRAINT audience_profiles_user_id_key UNIQUE (user_id);

ALTER TABLE public.user_strategies
  ADD CONSTRAINT user_strategies_user_id_key UNIQUE (user_id);
```

### Nenhuma mudanca de codigo

As Edge Functions e o frontend ja estao corretos — o upsert com `onConflict: "user_id"` vai funcionar assim que as constraints existirem.

### Depois da migração

O usuario deve refazer o onboarding (ou re-gerar a matriz) para que os dados sejam salvos corretamente desta vez.

