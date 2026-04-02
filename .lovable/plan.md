

# Limitar acesso a 1 dispositivo por vez

## Como funciona

Cada vez que o usuário faz login ou abre o app, registramos um "session token" unico no banco. Se outro dispositivo faz login com a mesma conta, o token muda e o dispositivo anterior e deslogado automaticamente na proxima verificacao.

## Implementacao

### 1. Migration: adicionar coluna `active_session_token` em `user_profiles`

```sql
ALTER TABLE public.user_profiles
ADD COLUMN active_session_token text;
```

### 2. `src/hooks/useUserProfile.ts`

- No login/carregamento da sessao, gerar um token unico (`crypto.randomUUID()`) e salvar no `localStorage` e na coluna `active_session_token` do perfil
- Criar um intervalo (a cada 30s) que verifica se o `active_session_token` no banco ainda bate com o token local
- Se nao bater, significa que outro dispositivo tomou a sessao: deslogar o usuario automaticamente e mostrar um toast ("Sua conta foi acessada em outro dispositivo")

### 3. Fluxo

```text
Dispositivo A faz login
  → gera token "abc123"
  → salva no banco e localStorage

Dispositivo B faz login com mesma conta
  → gera token "xyz789"
  → atualiza banco para "xyz789"

Dispositivo A verifica (polling 30s)
  → banco tem "xyz789", local tem "abc123"
  → mismatch → deslogar A automaticamente
```

### 4. Protecao extra na Auth page

- Apos `signInWithPassword` ou `signUp` com sessao, imediatamente gravar o novo token

### Arquivos impactados
- **Migration SQL** — adicionar `active_session_token` a `user_profiles`
- **`src/hooks/useUserProfile.ts`** — gerar token, gravar no banco, polling de verificacao, auto-logout
- **`src/pages/Auth.tsx`** — gravar token apos login bem-sucedido (ou delegar ao hook)

### Consideracoes
- O polling de 30s e leve (1 query simples por usuario)
- Se o usuario recarregar a pagina, o token local persiste no localStorage, nao precisa gerar outro
- Se o usuario fizer logout manual, o token e limpo

