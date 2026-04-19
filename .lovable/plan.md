
Erro: `user_progress` tem duplicatas pro user `fb358527...` então o `ALTER ADD UNIQUE` falha. O `DELETE` que dei antes provavelmente não pegou tudo (pode ter linhas com `updated_at` igual, ou a comparação `<` deixou pares empatados).

Solução: usar `ctid` (identificador físico de linha do Postgres) como tiebreaker — garante que sempre fica exatamente 1 linha por user, independente de timestamps duplicados.

## SQL pra rodar no Studio self-hosted

```sql
-- Limpa duplicatas em TODAS as tabelas 1-por-user usando ctid (sempre funciona)
DELETE FROM public.user_progress
WHERE ctid NOT IN (
  SELECT max(ctid) FROM public.user_progress GROUP BY user_id
);

DELETE FROM public.user_usage
WHERE ctid NOT IN (
  SELECT max(ctid) FROM public.user_usage GROUP BY user_id
);

DELETE FROM public.user_strategies
WHERE ctid NOT IN (
  SELECT max(ctid) FROM public.user_strategies GROUP BY user_id
);

DELETE FROM public.audience_profiles
WHERE ctid NOT IN (
  SELECT max(ctid) FROM public.audience_profiles GROUP BY user_id
);

DELETE FROM public.user_profiles
WHERE ctid NOT IN (
  SELECT max(ctid) FROM public.user_profiles GROUP BY user_id
);

-- Agora adiciona as constraints
ALTER TABLE public.user_progress     ADD CONSTRAINT user_progress_user_id_unique     UNIQUE (user_id);
ALTER TABLE public.user_usage        ADD CONSTRAINT user_usage_user_id_unique        UNIQUE (user_id);
ALTER TABLE public.user_strategies   ADD CONSTRAINT user_strategies_user_id_unique   UNIQUE (user_id);
ALTER TABLE public.audience_profiles ADD CONSTRAINT audience_profiles_user_id_unique UNIQUE (user_id);
ALTER TABLE public.user_profiles     ADD CONSTRAINT user_profiles_user_id_unique     UNIQUE (user_id);

-- Verifica
SELECT conrelid::regclass AS tabela, conname FROM pg_constraint WHERE conname LIKE '%_user_id_unique';
```

Se algum `ALTER` reclamar `already exists`, ignora (já foi criado antes). Se aparecer `23505` em outra tabela, o mesmo padrão de `DELETE ... ctid NOT IN ...` resolve.

## Por que isso é robusto
- `max(ctid)` sempre retorna exatamente 1 linha por grupo, sem empate.
- Funciona mesmo se `updated_at` for `NULL` ou idêntico entre as duplicatas.
- Mantém a linha fisicamente mais nova (último insert/update).

Sem mudança de código.
