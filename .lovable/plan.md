## TL;DR

Fiz a auditoria dos 6 templates (`signup`, `magic-link`, `recovery`, `invite`, `email-change`, `reauthentication`). **Só o `recovery` tinha o bug** porque é o único fluxo que precisa de uma tela dedicada (`/reset-password`) com a sessão já ativa. Os outros caem em rotas que já funcionam em qualquer estado de auth. Mesmo assim dá pra blindar o app com um pequeno reforço preventivo.

## Análise por template

| Template | Para onde redireciona | Estado da sessão | Rota destino existe? | Status |
|---|---|---|---|---|
| `signup` | `window.location.origin` (`/`) | autenticado | `/` → `<Index />` (auth) ou `<Landing />` (unauth) | ok |
| `magic-link` | `SITE_URL` (`/`) | autenticado | `/` → `<Index />` | ok |
| `recovery` | `${origin}/reset-password` | autenticado (PASSWORD_RECOVERY) | `/reset-password` (corrigido na rodada anterior) | ok |
| `email-change` | `SITE_URL` (`/`) | autenticado | `/` → `<Index />` | ok |
| `invite` | `SITE_URL` (`/`) | autenticado, sem senha | `/` — mas usuário precisaria setar senha | n/a (app não usa convites hoje) |
| `reauthentication` | usa OTP de 6 dígitos, sem URL | — | — | ok |

Conclusão: nenhum bug latente nos demais fluxos no estado atual do app. O recovery era especial porque ele é o único que precisa renderizar uma tela específica (formulário de nova senha) **antes** dos guards de onboarding/access kickarem.

## Reforço preventivo (opcional, recomendado)

Pra não cair na mesma armadilha no futuro se algum dia adicionarmos `/accept-invite`, `/confirm-email`, etc., generalizar a "lista branca" de rotas públicas em `App.tsx`:

```tsx
const PUBLIC_AUTH_ROUTES = ['/reset-password'];
// futuramente: '/accept-invite', '/confirm-email-change', etc.

if (typeof window !== 'undefined' && PUBLIC_AUTH_ROUTES.includes(window.location.pathname)) {
  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* adicionar novas rotas aqui conforme criarmos os templates */}
    </Routes>
  );
}
```

Mudança puramente estrutural — comportamento idêntico ao de hoje, só fica mais fácil estender. Sem mudanças em backend, edge functions ou templates.

## Deploy

Frontend Vercel (auto). Nada na VPS.

## Posso aplicar?

Se quiser, aplico a refatoração agora. Se preferir deixar como está (a rota única já resolve), também ok — não há problema iminente.
