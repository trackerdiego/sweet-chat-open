
## Objetivo

1. Toast verde correto ("Email enviado!") em vez do fallback genérico — corrigindo `check-email-exists`.
2. Email de recuperação chegando com remetente **Vyral Lab** e template novo com identidade visual da marca.

---

## Parte 1 — Fix `check-email-exists` (Lovable)

**Diagnóstico:** No self-hosted, o PostgREST não expõe o schema `auth`, então `admin.schema('auth').from('users')` falha silenciosamente → catch retorna `exists: true, fallback: true` → toast mostra a versão genérica.

**Solução:** Criar RPC SECURITY DEFINER em `public` e chamar via `supabase.rpc`.

### 1a. Migration (SQL pra rodar no Studio self-hosted)

```sql
CREATE OR REPLACE FUNCTION public.email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = lower(p_email)
  );
$$;

REVOKE ALL ON FUNCTION public.email_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon, authenticated, service_role;
```

### 1b. Edge function `check-email-exists/index.ts`

Trocar a query `schema('auth').from('users')` por `admin.rpc('email_exists', { p_email: target })`. Mantém o mesmo contrato de resposta (`{ exists, fallback? }`).

### 1c. Auth.tsx

Sem mudança — o frontend já espera `{ exists: boolean, fallback?: boolean }`.

---

## Parte 2 — Sender name "Vyral Lab" (VPS, GoTrue env)

Editar `~/supabase/docker/.env`:

```
GOTRUE_SMTP_SENDER_NAME=Vyral Lab
```

(se a var atual for `SMTP_SENDER_NAME`, atualizar essa também; ambas funcionam dependendo da versão do GoTrue)

Depois: `docker compose up -d --force-recreate auth` no diretório `~/supabase/docker`.

---

## Parte 3 — Template novo `recovery.html` (Vyral Lab)

Criar HTML standalone com a identidade da marca:

- Fundo branco (#ffffff) — regra de email
- Card com glassmorphism leve (borda sutil purple/violet)
- Logo Vyral Lab no topo (URL pública do logo já hospedado)
- Heading serif "Redefina sua senha"
- Texto curto explicando que recebeu pq alguém pediu reset
- Botão CTA roxo/violet (gradient simulado via background-color sólido com fallback)
- Variável GoTrue: `{{ .ConfirmationURL }}`
- Aviso "se não foi você, ignore este email"
- Footer com "Vyral Lab — Sua jornada de 30 dias começa aqui"

Entrego o arquivo `recovery.html` finalizado pra você subir no **Studio → Storage → bucket `emails` → pasta `emails/` → Replace `recovery.html`**.

Nada de mexer em `MAILER_TEMPLATES_*` — já tá apontando pro arquivo certo.

---

## Bloco copia-e-cola final (VPS)

No fim da resposta de execução, vou entregar:

```bash
# 1. Atualizar env e reiniciar GoTrue
cd ~/supabase/docker
# editar .env e setar GOTRUE_SMTP_SENDER_NAME=Vyral Lab
docker compose up -d --force-recreate auth

# 2. Deploy do check-email-exists corrigido
cd /root/app
git pull origin main
./scripts/deploy-selfhost.sh check-email-exists
```

E você sobe o `recovery.html` manualmente pelo Studio Storage.

---

## Detalhes técnicos

- **RPC vs query direta:** RPC SECURITY DEFINER funciona em qualquer setup (Lovable Cloud OU self-hosted), independente das exposições do PostgREST. Mais portável.
- **Por que `GRANT EXECUTE TO anon`:** o frontend chama com a anon key. Sem `verify_jwt`, a function precisa que a RPC seja chamável pelo role anônimo.
- **Sender name no .env, não no docker-compose:** essa var não é secret nem precisa estar exposta no `environment:` do compose, fica direto no `.env` que o GoTrue lê.
- **Template no Storage, não no .env:** templates HTML grandes não cabem em env var; GoTrue já tá configurado pra puxar do Storage via `MAILER_TEMPLATES_RECOVERY=...recovery.html`.

