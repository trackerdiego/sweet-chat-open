

# Corrigir Erro "Não é possível criar o perfil" no Onboarding

## Causa Raiz

O trigger `handle_new_user` que deveria criar automaticamente o perfil do usuario quando ele se cadastra **nao existe no banco**. A funcao SQL existe mas nenhum trigger a chama. Isso significa que o perfil so e criado pelo frontend (`fetchProfile`), o que causa uma race condition: quando `handleFinish` roda, pode tentar atualizar um perfil que ainda nao foi criado de forma estavel.

## Plano

### 1. Criar o trigger ausente no banco

Migracao SQL para criar o trigger `on_auth_user_created` que chama `handle_new_user` apos cada novo cadastro:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

Isso garante que todo novo usuario ja tenha perfil criado antes de chegar ao onboarding.

### 2. Tornar `handleFinish` mais robusto

**Arquivo:** `src/pages/Onboarding.tsx`

- Envolver a chamada `updateProfile` em try-catch
- Se falhar, tentar novamente uma vez antes de desistir
- Remover a dependencia de o perfil ja existir — se o update falhar, tentar insert direto como fallback

### Arquivos alterados

1. Migracao SQL (trigger)
2. `src/pages/Onboarding.tsx` (error handling)

