# Domínio no ar — próximos passos (backend mínimo + Asaas + QA)

App já responde em `https://app.vyrallab.online/`. Falta destravar **3 frentes** pra ele funcionar 100% (login, checkout, links).

---

## 1. CORS / Allowed origins na VPS (ÚNICA mexida obrigatória no backend)

Hoje o GoTrue só aceita redirect/origin de `app.influlab.pro`. Sem isso, signup/login/reset vão dar erro no `app.vyrallab.online`.

**Na VPS (`/root` ou onde estiver o stack):**

```bash
cd ~/supabase/docker

# editar .env
nano .env
```

Garantir/atualizar estas duas linhas (preservando o que já existe, só adicionando o novo origin):

```
SITE_URL=https://app.influlab.pro
ADDITIONAL_REDIRECT_URLS=https://app.vyrallab.online,https://app.vyrallab.online/*,https://app.influlab.pro,https://app.influlab.pro/*,http://localhost:5173
GOTRUE_URI_ALLOW_LIST=https://app.vyrallab.online,https://app.vyrallab.online/*,https://app.influlab.pro,https://app.influlab.pro/*
```

Manter `SITE_URL` em `app.influlab.pro` por enquanto — os templates de email continuam apontando pra lá e o usuário consegue logar pelos dois domínios (mesmo backend). Trocar `SITE_URL` só quando quiser desligar o domínio antigo.

```bash
docker compose up -d --force-recreate auth
```

(Não precisa recriar Kong — CORS dele já é wildcard no setup padrão self-hosted. Se algum request falhar com erro CORS no console, aí recriamos o Kong também.)

**Validação:** abrir `https://app.vyrallab.online/auth`, tentar cadastro novo + login. Deve funcionar.

---

## 2. Asaas — URLs de retorno do checkout

A `create-asaas-subscription` hoje passa `callback.successUrl` apontando pro front. Preciso varrer a function pra ver se está hardcoded ou se usa header `origin` do request (se for `origin`, **já funciona automaticamente** porque o navegador manda o origin novo).

**Ações:**
- Eu verifico `supabase/functions/create-asaas-subscription/index.ts` na hora de implementar
- Se hardcoded: troco `app.influlab.pro` → `app.vyrallab.online` e redeploy via `./scripts/deploy-selfhost.sh create-asaas-subscription`
- Se for `origin`: zero mudança

**Painel Asaas:** o webhook continua em `https://api.influlab.pro/functions/v1/asaas-webhook` (backend não mudou). **Não mexer.**

---

## 3. Varredura de strings `influlab.pro` no frontend

Já confirmei antes que **não há hardcode** no frontend (tudo usa env/relativo). Mas vou refazer a varredura agora pra garantir, focando em:

- `src/pages/Referral.tsx` (link de convite)
- `index.html` (meta tags, og:url, canonical)
- `public/manifest.json`
- Copy/textos visíveis em landing

Se aparecer algo, troco pra `app.vyrallab.online` e Vercel redeploya automático via GitHub.

---

## 4. SEO / extras (opcional, dá pra fazer depois)

- `public/robots.txt` — adicionar sitemap se aplicável
- Google Search Console — adicionar propriedade `vyrallab.online`
- `index.html` — atualizar `<title>` e `og:url` absolutos se houver

---

## Ordem que vou executar quando você aprovar

1. Varrer código do front e da `create-asaas-subscription` (read-only)
2. Te entregar:
   - Bloco copia-cola pra rodar na VPS (passo 1 acima)
   - Lista exata de arquivos a alterar (se houver) com diff
   - Comando de redeploy de edge function (se necessário)
   - Passo a passo do que conferir no painel Asaas
3. Você roda na VPS + confirma no Asaas
4. Eu commito as mudanças de front (se houver) → Vercel auto-deploy
5. Smoke test completo: signup → onboarding → checkout → webhook → premium

---

## O que continua INTOCADO

- Schema Postgres, RLS, triggers ✅
- Secrets ✅
- Webhook Asaas URL (`api.influlab.pro`) ✅
- SMTP + templates de email ✅
- `SITE_URL` do GoTrue (mantém `app.influlab.pro` por ora) ✅
- Todas as outras edge functions ✅

Posso seguir?
