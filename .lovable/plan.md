# Plano: Apontar `vyrallab.online` mantendo backend intocado

Escopo restrito: só **frontend + DNS + integrações externas**. Backend self-hosted (`api.influlab.pro`, Supabase, edge functions, SMTP, templates de email) **fica exatamente como está**. App continua chamando `api.influlab.pro` por baixo — usuário só vê a URL nova.

## Arquitetura final

```
vyrallab.online        → landing (Vercel, redirect pra app ou marketing)
app.vyrallab.online    → app React (Vercel, mesmo deploy de hoje)
        │
        └── chama por baixo ──► api.influlab.pro (VPS, INTOCADO)
```

Nenhum subdomínio de API novo. `api.vyrallab.online` fica pra depois.

## 1. DNS no registrar do `.online`

- `A   @                  → IP do Vercel` (ou CNAME conforme instrução do Vercel)
- `A   www                → IP do Vercel`
- `A   app                → IP do Vercel` (mesmo deploy)

SSL: Vercel emite automático.

## 2. Vercel

- Adicionar `vyrallab.online`, `www.vyrallab.online` e `app.vyrallab.online` no projeto atual.
- Definir `app.vyrallab.online` como **domínio primário** (ou manter os 3 ativos, redirecionando raiz → app conforme você decidir).
- **Nenhuma variável de ambiente muda** — `VITE_SUPABASE_URL` continua `https://api.influlab.pro`.

## 3. Código do frontend — o que ajustar

Tudo que tem URL absoluta `influlab.pro` apontando pro **front** (não pro back). Vou varrer e ajustar:

- `index.html` — `og:url`, canonical, qualquer meta absoluto
- `public/manifest.json` — `start_url`/`scope` (manter relativos, só conferir)
- `src/pages/Referral.tsx` — link de convite gerado (`https://app.influlab.pro/?ref=...` → `https://app.vyrallab.online/?ref=...`)
- Edge functions que **montam links pro front** (reset password, callback Asaas success/cancel, email templates que linkam pro app): trocar `https://app.influlab.pro` por `https://app.vyrallab.online`
  - Isso **é mudança de código de edge function** — você vai precisar redeployar pela VPS (`./scripts/deploy-selfhost.sh`), mas **não mexe em schema, secret nem container**. Se preferir adiar, dá pra usar variável `PUBLIC_APP_URL` e trocar só no `.env` da VPS depois.
- Qualquer string `influlab.pro` em copy/landing (textos visíveis): substituir por `vyrallab.online`

Vou listar arquivo por arquivo na hora de implementar — sem chutar agora.

## 4. Asaas

- Painel Asaas → Webhooks: **manter o webhook atual apontando pra `https://api.influlab.pro/functions/v1/asaas-webhook`**. Não muda nada, porque o backend não mudou.
- **URLs de retorno do checkout** (success/cancel) que hoje voltam pro app: atualizar pra `https://app.vyrallab.online/...` no painel Asaas e/ou no payload enviado pela edge function `create-asaas-subscription`.

## 5. CORS / Allowed origins (single ponto sensível)

A VPS hoje aceita requests de `app.influlab.pro`. Quando o app passar a rodar em `app.vyrallab.online`, o navegador vai mandar `Origin: https://app.vyrallab.online`. Precisa adicionar o novo origin em **2 lugares na VPS** (única mexida no backend, e é só env, sem schema/secret novo):

- `~/supabase/docker/.env`:
  - `ADDITIONAL_REDIRECT_URLS=https://app.vyrallab.online,https://app.influlab.pro,http://localhost:5173`
  - `GOTRUE_URI_ALLOW_LIST=https://app.vyrallab.online/*,https://app.influlab.pro/*`
- Kong/nginx CORS (se houver allowlist explícita): adicionar `https://app.vyrallab.online`
- `docker compose up -d --force-recreate auth kong`

Sem isso, login/signup/reset quebram no domínio novo. **É o único toque obrigatório no backend** — todo o resto (Postgres, edge functions, SMTP, templates, webhook Asaas) fica zero alteração.

## 6. Email (zero mudança)

Templates no bucket `emails/emails/` continuam linkando pra `app.influlab.pro` — usuário consegue logar pelos dois domínios porque o backend é o mesmo. Quando você quiser migrar 100%, basta trocar a env `SITE_URL` no GoTrue depois.

## 7. SEO / marca

- Atualizar `index.html` títulos e descrições (já estão "Vyral Lab", só conferir URLs absolutas se houver)
- Sitemap/robots: se existir, atualizar URL base
- Google Search Console: registrar a propriedade nova `vyrallab.online`

## 8. Ordem de execução (sem downtime)

1. Comprar `vyrallab.online`
2. Configurar DNS (propagação ~1h)
3. Adicionar domínios no Vercel + aguardar SSL
4. Adicionar `https://app.vyrallab.online` no `ADDITIONAL_REDIRECT_URLS` e `GOTRUE_URI_ALLOW_LIST` da VPS (único `docker compose up -d --force-recreate auth kong`)
5. Atualizar URLs de retorno no painel Asaas
6. Ajustar strings `influlab.pro` no código do front + redeploy Vercel (auto via GitHub)
7. Testar fluxo no `app.vyrallab.online`: signup → onboarding → checkout Asaas → retorno → premium
8. `app.influlab.pro` continua funcionando em paralelo — desliga quando você quiser

## Resumo do que NÃO muda

- Supabase URL no app (`api.influlab.pro`) ✅ intocado
- Schema, RLS, functions DB ✅ intocado
- Secrets ✅ intocado
- Webhook Asaas URL ✅ intocado
- SMTP / templates de email ✅ intocado
- Edge functions (código) ✅ intocado se você aceitar que os links de email/reset continuem apontando pra `app.influlab.pro` por enquanto

Quer que eu siga assim quando você confirmar o domínio comprado?
