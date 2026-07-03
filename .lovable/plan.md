# Reset manual de senha — mazzuzconfeccoess@gmail.com

O backend é **Supabase self-hosted em `api.influlab.pro`**, então nada disso passa por migration do Lovable. Você roda direto no **SQL Editor do Studio self-hosted** (`https://studio.influlab.pro` ou o domínio que você configurou pro Studio).

## Passo 1 — Confirmar que a usuária existe

Rode no SQL Editor:

```sql
select id, email, email_confirmed_at, last_sign_in_at, created_at, banned_until
from auth.users
where email = 'mazzuzconfeccoess@gmail.com';
```

O que olhar:
- Se **não retornar linha** → ela nunca criou conta (o email do "reset" nem chega, GoTrue silencia por segurança). Peça pra ela cadastrar de novo.
- Se `email_confirmed_at` for `NULL` → conta existe mas email nunca foi confirmado. O passo 2 já resolve os dois problemas de uma vez (define senha + confirma email).
- Se `banned_until` estiver no futuro → conta banida, o passo 2 também limpa.

## Passo 2 — Definir senha temporária e confirmar email

Escolha uma senha temporária (ex.: `Vyral@2026Reset`) e rode:

```sql
update auth.users
set
  encrypted_password = crypt('Vyral@2026Reset', gen_salt('bf')),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  banned_until = null,
  updated_at = now()
where email = 'mazzuzconfeccoess@gmail.com';
```

Isso:
- Sobrescreve o hash da senha usando `bcrypt` (mesmo esquema que o GoTrue usa)
- Confirma o email se ainda não estava confirmado
- Remove qualquer ban

## Passo 3 — Invalidar sessões antigas (opcional, recomendado)

Pra garantir que qualquer sessão zumbi caia:

```sql
delete from auth.sessions
where user_id = (select id from auth.users where email = 'mazzuzconfeccoess@gmail.com');
```

## Passo 4 — Comunicar a usuária

Manda no WhatsApp/email dela:

> "Redefinimos sua senha manualmente. Entre em `app.influlab.pro` com:
> **Email:** mazzuzconfeccoess@gmail.com  
> **Senha:** Vyral@2026Reset  
> Depois de entrar, vai em Configurações → Alterar senha e troca pra uma sua."

## Por que o reset por email pode estar falhando (pra investigar depois)

Possíveis causas — não vou mexer agora, só listar pro caso de repetir com outros usuários:

1. **Email não chegou** → checar `email_send_log` filtrando por `recipient_email = 'mazzuzconfeccoess@gmail.com'` e `template_name = 'recovery'`
2. **Email chegou mas link expirou** → tokens de recovery no GoTrue expiram em 1h por padrão
3. **Link abre mas não redireciona pro `/reset-password`** → problema no `redirectTo` que o Auth.tsx envia
4. **Página `/reset-password` não detecta `type=recovery`** no hash → bug no `ResetPassword.tsx`

Se quiser, na próxima eu investigo isso e conserto o fluxo end-to-end. Mas pra desbloquear a usuária hoje, os 3 passos acima resolvem.
