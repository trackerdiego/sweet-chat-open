

# Forçar re-onboarding para usuários com nicho "lifestyle"

## Problema
Usuários que ficaram com o nicho padrão "lifestyle" estão tendo experiência ruim porque o estudo de público e a matriz ficam genéricos.

## Solução
Executar um UPDATE no banco de dados para setar `onboarding_completed = false` em todos os perfis onde `primary_niche = 'lifestyle'`. 

O app já redireciona automaticamente para o onboarding quando `onboarding_completed = false` (lógica em `App.tsx` via `needsOnboarding`), então não precisa mudar código nenhum.

## Execução
- Um único comando SQL via migration tool:
```sql
UPDATE user_profiles 
SET onboarding_completed = false 
WHERE primary_niche = 'lifestyle';
```

## Resultado
- Na próxima vez que esses usuários abrirem o app, serão redirecionados ao onboarding (agora com mínimo de 80 caracteres e dicas)
- Usuários que já preencheram corretamente não são afetados
- Nenhuma alteração de código necessária

