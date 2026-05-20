# Trocar email de suporte + ajustes no .env da VPS

## 1. Frontend (3 ocorrências de `suporte@influlab.pro`)

| Arquivo | Linha | Mudança |
|---|---|---|
| `src/pages/Help.tsx` | 28 | `'suporte@influlab.pro'` → `'suporte@vyrallab.online'` |
| `src/components/Navigation.tsx` | 55 | idem no `mailto:` |
| `src/components/Navigation.tsx` | 281 | idem no texto `<strong>` |

`src/integrations/supabase/client.ts` **NÃO muda** — `api.influlab.pro` continua sendo a URL do seu backend self-hosted.

## 2. Seu `.env` da VPS — o que adicionar/ajustar

Você me mandou só um pedaço do `.env` (imgproxy + TLS proxy + alguns secrets). As linhas que importam pro domínio novo são **`SITE_URL`**, **`ADDITIONAL_REDIRECT_URLS`** e **`GOTRUE_URI_ALLOW_LIST`** — que ficam mais acima no arquivo e você não colou.

**Procure essas 3 chaves no seu `~/supabase/docker/.env` e deixe assim** (mantém o domínio antigo funcionando em paralelo):

```env
SITE_URL=https://app.influlab.pro
ADDITIONAL_REDIRECT_URLS=https://app.vyrallab.online,https://app.vyrallab.online/*,https://app.influlab.pro,https://app.influlab.pro/*,http://localhost:5173
GOTRUE_URI_ALLOW_LIST=https://app.vyrallab.online,https://app.vyrallab.online/*,https://app.influlab.pro,https://app.influlab.pro/*
```

Se alguma dessas chaves **não existir** no seu .env, adicione na seção do auth/GoTrue.

Do trecho que você colou, **nada precisa mudar**:
- `IMGPROXY_AUTO_WEBP` ✅
- `PROXY_DOMAIN` / `CERTBOT_EMAIL` ✅ (só usados se rodar Caddy/Nginx do template — você não usa, está no Cloudflare/Vercel)
- `ASAAS_WEBHOOK_TOKEN` ✅
- `EDGE_RUNTIME_*` ✅
- `CRON_SECRET` ✅
- `suporte@vyrallab.online` ← essa linha solta no final **deve ser apagada**, não é variável válida (não tem `CHAVE=valor`)

## 3. Comando pra aplicar na VPS

```bash
cd ~/supabase/docker
nano .env   # ajustar SITE_URL/ADDITIONAL_REDIRECT_URLS/GOTRUE_URI_ALLOW_LIST + apagar linha solta
docker compose up -d --force-recreate auth
```

## 4. Ordem

1. Você aprova → eu altero os 3 lugares no frontend (commit → Vercel auto-deploy)
2. Você roda o bloco do passo 3 na VPS
3. Smoke test: login em `app.vyrallab.online/auth` + clicar email de suporte em `/ajuda` (deve abrir `suporte@vyrallab.online`)

Posso seguir?
