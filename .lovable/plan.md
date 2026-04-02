

# Corrigir status pendente para usuários com descrição real

## Causa raiz

O backfill da migração anterior rodou **antes** do usuário preencher a descrição. Quando ele preencheu depois, o fluxo de onboarding pode ter falhado antes de chegar ao `finalizeOnboarding()`, ou o usuário pode ter atualizado a descrição fora do fluxo completo de onboarding. Resultado: `primary_niche` tem texto real, mas `description_status` ficou `pending`.

## Solução

### 1. Migração SQL para corrigir dados inconsistentes

Rodar um UPDATE que marca como `ok` todos os usuários que:
- Tem `primary_niche` diferente de `'lifestyle'` e não vazio
- Mas ainda estão com `description_status = 'pending'`

```sql
UPDATE public.user_profiles
SET description_status = 'ok',
    onboarding_completed = true
WHERE primary_niche IS NOT NULL
  AND primary_niche != 'lifestyle'
  AND primary_niche != ''
  AND description_status = 'pending';
```

Isso corrige o `agentevendeagente@gmail.com` e qualquer outro usuário na mesma situacao.

### 2. Nenhuma mudanca de codigo necessaria

O `updateProfile` e o `finalizeOnboarding` ja estao corretos. O problema foi apenas dados desatualizados no banco.

### Arquivos impactados
- Nova migracao SQL (apenas UPDATE de dados)

