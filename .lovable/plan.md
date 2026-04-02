

# Corrigir logica de status de onboarding e banner

## Problemas identificados

1. **Usuarios "lifestyle" marcados como "Completo"**: A migracao anterior so corrigiu usuarios com descricao >= 80 chars. Quem tem `primary_niche = 'lifestyle'` e `onboarding_completed = true` nao foi tocado.

2. **Admin vendo banner de descricao incompleta**: O banner usa `primary_niche.length < 80` como condicao, mas o admin (e outros usuarios) podem ter descricoes boas com menos de 80 caracteres — eles preencheram antes da regra de 80 chars existir.

## Solucao

### 1. Migracao SQL
Resetar onboarding para usuarios que ainda tem o valor padrao "lifestyle":
```sql
UPDATE user_profiles 
SET onboarding_completed = false 
WHERE primary_niche = 'lifestyle' 
  AND onboarding_completed = true;
```

### 2. Corrigir condicao do banner em `Index.tsx`
Trocar a logica de `primary_niche.length < 80` para verificar se o nicho e um valor padrao/generico (palavra unica sem espacos). Usuarios que escreveram qualquer descricao real (com espacos, frases) nao verao o banner:

```
Condicao antiga: profile.primary_niche.length < 80
Condicao nova: profile.primary_niche.trim().split(' ').length <= 2
```

Isso mostra o banner apenas para quem tem 1-2 palavras (ex: "lifestyle", "fitness coach") mas nao para quem escreveu uma frase real.

### 3. Corrigir condicao do status "Onboarding" no Admin
No painel admin, o status de onboarding deve considerar tambem se a descricao e valida (nao apenas o campo booleano). Mostrar "Pendente" se `onboarding_completed = false` OU `primary_niche` for valor generico.

### Arquivos alterados
- Nova migracao SQL
- `src/pages/Index.tsx` (condicao do banner)
- `src/pages/Admin.tsx` (logica de status no painel)

