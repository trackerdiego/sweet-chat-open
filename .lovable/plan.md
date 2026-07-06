## Problema

Depois do onboarding + geração de matriz, a cliente cai na tela **CheckoutModal** (imagem que você mandou — "Garanta seu acesso / DADOS / PAGAMENTO / CONFIRMAÇÃO"). Essa tela pode ser aberta por **3 caminhos diferentes** e sem log do device dela é impossível cravar qual é:

1. `AutoCheckoutOpener` → abriu porque `sessionStorage[pending_checkout_plan]` ainda existia ou porque a URL trouxe `?openCheckout=...`
2. `AccessGuard` → `useSubscription().hasAccess === false` (linha `subscription_state` retornou `status !== 'active'`, ou a query falhou nas 2 tentativas e caiu no default `trial` expirado)
3. Botão manual em `PaywallScreen`, `PremiumGate`, `TrialBanner`, etc.

Como não dá pra pedir console dela, vamos **gravar cada abertura da modal num log server-side** que a gente consulta depois via SQL no Studio self-hosted. Assim, na próxima vez que ela cair na tela, temos o "raio-x" completo:  qual gatilho, o que o `subscription_state` retornou naquele instante, o que estava no `sessionStorage`, a URL, se o webhook Asaas já rodou pra ela, etc.

## O que vai ser feito

### 1. Nova tabela `client_diagnostics` (SQL manual no Studio self-hosted)

```text
client_diagnostics
├── id uuid pk
├── user_id uuid            -- auth.uid()
├── event text              -- 'checkout_opened' | 'access_guard_blocked' | 'auto_opener_fired'
├── source text             -- 'AutoCheckoutOpener' | 'AccessGuard' | 'PaywallScreen' | 'manual'
├── payload jsonb           -- snapshot completo (ver abaixo)
├── created_at timestamptz default now()
```

RLS: `INSERT` liberado pro `authenticated` (`WITH CHECK (auth.uid() = user_id)`). `SELECT` só pro service_role (a gente consulta via Studio).

Snapshot em `payload`:
```json
{
  "route": "/",
  "url": "https://app.influlab.pro/?...",
  "subscription": { "status": "...", "plan": "...", "current_period_end": "...", "asaas_customer_id": "..." },
  "hasLoadedOnce": true,
  "sessionStorage": { "pending_checkout_plan": "...", "checkout:v1": "..." },
  "onboardingCompleted": true,
  "hasAccess": false,
  "isActive": false,
  "trigger": "auto-opener" | "access-guard" | "manual-btn"
}
```

### 2. Helper `src/lib/diagnostics.ts`

`logDiagnostic(event, source, payload)` → chama `supabase.from('client_diagnostics').insert(...)`. Silencioso (nunca joga erro pra UI). No-op se sem sessão.

### 3. Instrumentar os 3 gatilhos

- **`AutoCheckoutOpener`** — quando detecta `candidate` e vai chamar `setOpen(true)`, dispara `logDiagnostic('checkout_opened', 'AutoCheckoutOpener', {...})`.
- **`AccessGuard`** — quando renderiza o bloqueio (`!hasAccess && !ALWAYS_OPEN`), dispara `logDiagnostic('access_guard_blocked', 'AccessGuard', {...})` uma vez por render de path (usando `useRef` para não spammar).
- **`CheckoutModal`** — no `useEffect` que detecta `open === true` na borda de subida, dispara `logDiagnostic('checkout_opened', 'CheckoutModal', { activeAtOpen, ... })`. Isso captura QUALQUER caller (inclusive manual).

### 4. Como você vai usar depois que ela cair de novo

SQL no Studio:
```sql
select created_at, event, source, payload
from public.client_diagnostics
where user_id = '<uuid da cliente>'
order by created_at desc
limit 20;
```

Com isso você vê, em ordem:
- Se `AutoCheckoutOpener` disparou → o `sessionStorage` ainda tinha coisa (bug de limpeza).
- Se `AccessGuard` bloqueou → `subscription.status` retornou o quê exatamente naquele device (`trial` expirado? `active` mas `useSubscription` não sincronizou? row nula?).
- Se veio de um botão manual → algum componente reabriu.

### 5. Bloco copia-e-cola pra VPS

No fim vai o SQL de migration + `deploy-selfhost.sh` do frontend (mas frontend é Vercel auto, então só o SQL precisa rodar manual + push do código).

## Arquivos

- **novo** `src/lib/diagnostics.ts`
- **editar** `src/components/AutoCheckoutOpener.tsx`
- **editar** `src/components/AccessGuard.tsx`
- **editar** `src/components/CheckoutModal.tsx`
- **SQL manual** (não migration Lovable — backend é self-hosted): `CREATE TABLE public.client_diagnostics` + GRANTs + RLS + policies

## Escopo NÃO incluído

- Nenhuma alteração de lógica de assinatura, onboarding ou webhook. Isso aqui é **puramente instrumentação** — depois que a gente ler os logs dela, aí sim atacamos a causa raiz com certeza.
- Nada de UI muda pra usuário final.

Confirma que posso instrumentar assim? Quando a cliente logar de novo e cair na tela, a gente resolve com dados reais em vez de chutar.
