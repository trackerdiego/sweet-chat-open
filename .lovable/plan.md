# Rebrand final: Influ Lab → Vyral Lab

Varredura completa do código. Vou separar **o que muda** (texto visível pro usuário) de **o que NÃO muda** (URLs de infra, chaves internas que quebrariam dados existentes).

## O que muda (visível pro usuário)

### 1. Title no switcher do navegador / ícone de PWA
**Causa**: iOS Safari/Chrome usa `apple-mobile-web-app-title` para o nome quando o app está adicionado à tela inicial e no switcher de abas. Está faltando.

- **`index.html`**: adicionar `<meta name="apple-mobile-web-app-title" content="Vyral Lab" />`. O `<title>` já está "Vyral Lab".
- **`public/manifest.json`**: já está "Vyral Lab" — manter.

### 2. Push notifications ainda mostram "Influlab"
**Causa raiz**: service worker antigo (`influlab-v1`) está cacheado no device do user. Mesmo trocando títulos, o SW velho continua respondendo até o cache ser invalidado.

- **`public/sw-push.js`**: bump `CACHE_NAME` de `influlab-v1` → `vyrallab-v2`. Isso força `activate` novo e deleta cache antigo. Default title fallback já é "Vyral Lab".
- **`supabase/functions/scheduled-push/index.ts`**: títulos já estão como "Vyral Lab" / emojis. Nada a mudar lá (linha 292 fala "influencer" — palavra comum, mantida).

### 3. Landing page — tabela comparativa
- **`src/components/landing/ComparisonTable.tsx`**: chave do objeto `influlab` → `vyrallab` (só rename de campo TS, sem impacto visual; mais limpo).

### 4. Edge functions com texto visível

- **`supabase/functions/auth-email-hook/index.ts`**: `SITE_NAME = "InfluLab"` → `"Vyral Lab"`. (Aparece no corpo do email se template usar `{{site_name}}`.)
- **`supabase/functions/create-asaas-subscription/index.ts`**: descrição da cobrança Asaas `"InfluLab Pro - Assinatura..."` → `"Vyral Lab Pro - Assinatura..."` (aparece no extrato/boleto do cliente).
- **`supabase/functions/_shared/hype-sources.ts`**: User-Agent `InfluLabHypeBot` → `VyralLabHypeBot` (cosmético, só log de sites scrapados).

## O que NÃO muda (infraestrutura / dados existentes)

- **`api.influlab.pro`, `app.influlab.pro`** — domínios reais da VPS self-hosted. Trocar quebra tudo.
- **Chaves de `localStorage` (`influlab.theme`, `influlab.onboardingRunId`, `influlab_session_token`, `influlab.installVideoSeen`)** — renomear deslogaria todos os users e perderia preferências. Mantém.
- **Header `x-influlab-function-version`** — usado em scripts de diagnóstico/deploy (`MIGRATION-FUNCTIONS.md`). Cosmético, mantém.
- **Hooks `useInfluencer`, coluna DB `influence_points`** — referem-se a "influencer/influência" (palavra), não à marca. Mantém.
- **Domínios de email `notify.app.influlab.pro`** dentro de `auth-email-hook` — infra DNS configurada, mantém. Só `SITE_NAME` muda.
- **Docs `MIGRATION-FUNCTIONS.md` / `TESTE-CHECKLIST.md`** — internos, com URLs reais da VPS. Mantém.

## Deploy

Frontend (Vercel) faz auto-deploy do GitHub. Edge functions precisam ser redeployadas na VPS:

```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh auth-email-hook create-asaas-subscription
```

Para o cache do service worker no celular do user: depois do deploy do frontend, o SW novo (`vyrallab-v2`) será detectado na próxima abertura, ativado, e o cache antigo (`influlab-v1`) deletado automaticamente. O título "Influlab" no switcher do iOS só some depois de **remover o ícone da tela inicial e re-adicionar** (limitação do iOS — não tem como forçar via código).
