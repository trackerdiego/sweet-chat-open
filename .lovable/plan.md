

User quer marcar `agentevendeagente@gmail.com` como premium. Basta um UPDATE em `user_usage.is_premium = true` para esse user_id. Preciso achar o user_id via auth.users → user_usage.

## Plano

1. Buscar user_id na tabela `user_profiles` cruzando com auth (ou direto via SQL no auth.users).
2. Rodar UPDATE em `user_usage` setando `is_premium = true` para esse user_id. Se não existir linha em `user_usage`, fazer INSERT.
3. Confirmar com SELECT.

### SQL a executar (via insert tool, não migração)

```sql
-- Garante linha em user_usage e marca premium
INSERT INTO public.user_usage (user_id, is_premium)
SELECT id, true FROM auth.users WHERE email = 'agentevendeagente@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET is_premium = true;
```

Observação: se não houver UNIQUE em `user_usage.user_id`, faço UPDATE primeiro e INSERT condicional como fallback.

### Resultado esperado
- Login com `agentevendeagente@gmail.com` → `isPremium = true` no `useUserUsage`
- Acesso liberado a todos os 30 dias da matriz, scripts/tools/chat/transcrição ilimitados, botão "Redefinir perfil" habilitado.

Sem mudança de código necessária — é só dado.

