## Problema

O usuário admin (`agentevendeagente@gmail.com`) está com onboarding completo, premium ativo e matriz de 30 itens no banco — mas ao logar foi jogado pro onboarding.

A causa é a **trava de integridade** no `useUserProfile.ts` (`fetchProfile`, ~linhas 110-130): se o `select` em `user_strategies` falhar silenciosamente (401 transitório, race com session, RLS hiccup) e retornar `data=null`, o código trata como "matriz inválida" e **escreve `onboarding_completed=false` no banco**, mandando o usuário pro onboarding mesmo com tudo certo.

A trava foi criada pra cobrir um bug antigo (perfil completo sem matriz), mas hoje está agressiva demais: confunde "query falhou" com "matriz não existe".

## Mudanças (apenas em `src/hooks/useUserProfile.ts`)

### 1. Trava não-destrutiva

Reescrever o bloco de validação pra distinguir os 3 casos:

- **erro na query** → não fazer nada, apenas `console.warn`. Confia no banco.
- **query OK, `strategies` é array com <28 itens** → reset `onboarding_completed=false` (caso real e legítimo).
- **query OK, `data=null`** (sem row em `user_strategies`) → reset (igual ao comportamento atual nesse caso específico, mas só quando temos certeza que a query rodou).

Trocar a linha de destructuring atual por algo como:

```ts
const { data: strat, error: stratErr } = await supabase
  .from('user_strategies').select('strategies').eq('user_id', userId).maybeSingle();

if (stratErr) {
  console.warn('[useUserProfile] strategies check skipped (query error):', stratErr);
} else {
  const arr = strat?.strategies;
  const explicitlyMissing = strat === null;
  const arrayTooShort = Array.isArray(arr) && arr.length < 28;
  if (explicitlyMissing || arrayTooShort) {
    // reset onboarding_completed
  }
}
```

### 2. Whitelist do admin

Adicionar guard antes de toda a trava:

```ts
const ADMIN_EMAIL = 'agentevendeagente@gmail.com';
const isAdmin = session?.user?.email === ADMIN_EMAIL;

if (profileData.onboarding_completed && !isAdmin) {
  // ... trava de integridade roda só pra não-admin
}
```

Justificativa: você loga em vários devices/abas pra testar e não pode ser kickado pro onboarding por nenhuma checagem heurística.

### 3. Pós-mudança

- Single-session polling **fica como está** (você pediu).
- Como `agentevendeagente` já está com `onboarding_completed=true` no banco hoje, não precisa de SQL — só o deploy do frontend.

## Detalhes técnicos

**Arquivo único alterado:** `src/hooks/useUserProfile.ts`
**Backend:** nada. Sem migration, sem edge function, sem mudança no Asaas.
**Deploy:** Vercel pega automático do GitHub. **Sem comandos na VPS.**
**Risco:** baixo. Mudança torna a trava mais permissiva (menos resets), o que reduz o risco de falso-positivo. O reset legítimo (perfil completo + matriz realmente <28) continua funcionando.

## Checklist pós-deploy

1. Logar com `agentevendeagente@gmail.com` → deve ir direto pro `/` (dashboard), nunca mais pro `/onboarding`.
2. Logar com qualquer outro user que tenha matriz válida → idem, vai pro dashboard.
3. (Opcional) Criar conta nova de teste → continua passando pelo onboarding normalmente (a trava só atua quando `onboarding_completed=true`).