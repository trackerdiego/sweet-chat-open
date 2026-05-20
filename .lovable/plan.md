# Bug: reset-password some e cai em 404

## Causa raiz

Quando o usuário abre o link do email, o Supabase processa o token e cria uma sessão imediatamente (evento `PASSWORD_RECOVERY` = usuário autenticado). No `App.tsx` o `AppRoutes` tem 3 árvores de rota separadas por estado:

- **não autenticado** → inclui `/reset-password` ✅
- **needsOnboarding** → `*` → `Navigate to="/onboarding"` ❌
- **autenticado** → não tem `/reset-password`, então `*` cai em `<NotFound />` ❌

Por isso o form aparece por ~1s (enquanto `useUserProfile` ainda está com `loading=true`) e logo depois o re-render manda pra NotFound (a "tela com 404" que o user viu).

## Correção

Renderizar `/reset-password` **antes** de qualquer gating de auth/onboarding, em qualquer estado.

### Mudança em `src/App.tsx` (única edição)

No topo do `AppRoutes`, antes do `if (loading)`, adicionar:

```tsx
if (window.location.pathname === '/reset-password') {
  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
    </Routes>
  );
}
```

Assim a tela de nova senha não é interrompida nem pelo loading, nem pelo guard de autenticação, nem pelo onboarding.

## Observações

- Não precisa mexer em `ResetPassword.tsx` — já trata `type=recovery` e `PASSWORD_RECOVERY` corretamente.
- Após salvar a nova senha o `navigate('/')` continua funcionando: já está autenticado e o roteamento normal assume.
- Nada no backend / Supabase precisa mudar. É bug 100% de frontend.

## Deploy

Frontend roda no Vercel (auto-deploy do GitHub). Nada pra rodar na VPS.
