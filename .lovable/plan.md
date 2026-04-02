

# Corrigir status de onboarding e melhorar experiencia para usuarios com descricao incompleta

## Problema
A migracao anterior resetou todos os usuarios "lifestyle", incluindo alguns que ja tinham preenchido corretamente. Alem disso, usuarios que refizeram o onboarding ainda aparecem como "Pendente". Precisamos de uma abordagem mais inteligente.

## Plano

### 1. Migracao SQL para corrigir status
Setar `onboarding_completed = true` para usuarios que ja possuem descricao com 80+ caracteres (ja preencheram corretamente):
```sql
UPDATE user_profiles 
SET onboarding_completed = true 
WHERE length(primary_niche) >= 80 
  AND onboarding_completed = false;
```

### 2. Mensagem amigavel no onboarding para quem foi redirecionado
No componente `Onboarding.tsx`, quando o usuario ja tem um perfil mas foi redirecionado (descricao curta), mostrar um aviso amigavel no step 1 explicando:
- "Sua descricao anterior ficou muito curta"
- "Sem uma boa descricao, o estudo de publico e a matriz nao conseguem ser precisos"
- Pre-preencher os campos com os dados existentes do perfil

### 3. Banner persistente no app principal para descricoes curtas
Em `App.tsx` ou `Index.tsx`, adicionar um alerta para usuarios com `onboarding_completed = true` mas `primary_niche` com menos de 80 caracteres, incentivando a atualizar o perfil (link para /onboarding). Nao bloqueia, apenas avisa.

### Arquivos alterados
- Nova migracao SQL (corrigir status)
- `src/pages/Onboarding.tsx` (mensagem amigavel + pre-preenchimento)
- `src/pages/Index.tsx` (banner de descricao incompleta)

