

# Corrigir status de descrição no painel admin

## Problema

A edge function `admin-dashboard` não inclui o campo `description_status` no objeto de cada usuário retornado. O frontend (`Admin.tsx`) tenta acessar `(u as any).description_status`, que é sempre `undefined`, então todos aparecem como "Pendente".

## Solução

### 1. Edge function `supabase/functions/admin-dashboard/index.ts`

- Adicionar `description_status` ao select de `user_profiles`
- Incluir `description_status` no objeto retornado para cada usuário

### 2. Frontend `src/pages/Admin.tsx`

- Adicionar `description_status` à interface `UserData`
- Substituir `(u as any).description_status` por `u.description_status` (tabela e drawer)

### Arquivos impactados
- `supabase/functions/admin-dashboard/index.ts` — adicionar campo ao select e ao retorno
- `src/pages/Admin.tsx` — tipar e usar corretamente `description_status`

