## Diagnóstico

O teste com `naoexiste-teste-123@gmail.com` mostrou toast de sucesso porque a estratégia de sonda via `signInWithPassword` não funciona: o GoTrue retorna `"Invalid login credentials"` tanto para senha errada quanto para email inexistente (é proteção anti-enumeração nativa). O frontend interpreta isso como "email existe", chama `resetPasswordForEmail`, e o GoTrue responde 200 sem enviar nada (porque o usuário não existe).

Não é problema do Studio nem da VPS — o backend está correto. O frontend é que precisa de um caminho real pra checar existência.

## Solução

Criar uma edge function `check-email-exists` no Supabase self-hosted que usa a `SUPABASE_SERVICE_ROLE_KEY` pra consultar `auth.users` direto e responde `{ exists: true|false }`.

O frontend chama essa function antes do `resetPasswordForEmail`.

## Passos

### 1. Edge function `check-email-exists`
- Endpoint POST, recebe `{ email }`.
- CORS aberto pra `app.vyrallab.online` e preview Lovable.
- Usa `createClient` com `SUPABASE_SERVICE_ROLE_KEY` (já configurada no self-hosted) e roda:
  ```
  SELECT 1 FROM auth.users WHERE lower(email) = lower($1) LIMIT 1
  ```
- Retorna `{ exists: boolean }` com status 200.
- Sem autenticação (público) — só revela um booleano e já existe o trade-off aceito de enumeração.

### 2. Atualizar `src/pages/Auth.tsx`
- Trocar o `handleForgotPassword`: remover a sonda `signInWithPassword`.
- Chamar `supabase.functions.invoke('check-email-exists', { body: { email } })`.
- Se `exists === false` → mostrar "Não encontramos uma conta..." + botão "Criar conta".
- Se `exists === true` → seguir com `resetPasswordForEmail` e toast de sucesso.
- Se a function falhar (rede, 5xx) → fallback: chamar `resetPasswordForEmail` mesmo assim com mensagem genérica "Se o email existir, enviamos o link" pra não travar o usuário.

### 3. Deploy no self-hosted (bloco copia-e-cola pra VPS)
Como o backend é self-hosted, edge functions Lovable não chegam lá automaticamente. Vou entregar o código + comando:

```bash
cd /root/app
git pull
./scripts/deploy-selfhost.sh check-email-exists
# ou
docker compose restart functions
```

## Fora deste plano

- Template `recovery.html` novo — continua pendente upload manual no Studio (separado, já foi gerado antes).
- Outros templates (signup, magic_link, etc.) — fica pra depois.
- Mudar o "From name" do GoTrue — separado.

## Resultado esperado após implementar

- Email inexistente → toast vermelho + botão "Criar conta".
- Email existente → toast verde + email chega (com template antigo até você subir o `recovery.html` novo).