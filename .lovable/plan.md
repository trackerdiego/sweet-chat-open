

# Próximo passo: aplicar o fix na VPS

Eu já editei os 2 arquivos no Lovable (`process-email-queue/index.ts` e `auth-email-hook/index.ts`) pra não derrubarem mais o pool de functions quando `LOVABLE_API_KEY` está ausente. Agora **o código novo precisa chegar na VPS** — sem isso, o container continua rodando a versão antiga e as IAs continuam falhando.

## Bloco único pra colar na VPS

```bash
# 1. Puxa o código novo do GitHub
cd /root/app
git pull origin main

# 2. Confirma que os 2 arquivos vieram com o fix
grep -n "LOVABLE_API_KEY" supabase/functions/process-email-queue/index.ts | head -5
grep -n "LOVABLE_API_KEY" supabase/functions/auth-email-hook/index.ts | head -5

# 3. Recria o container functions pra carregar o código novo
cd ~/supabase/docker
docker compose up -d --force-recreate functions

# 4. Espera 5s e confirma que o erro sumiu
sleep 5
docker compose logs functions --tail 100 2>&1 | grep -iE "missing required|booted|listening|error" | tail -30
```

## O que esperar

- **Antes**: 51× `[Error] Missing required environment variables`
- **Depois**: nenhum `Missing required` novo. Aparecem só `booted (time: …ms)` quando uma function é chamada.

## Validação no app

Logado como `agentevendeagente@gmail.com` em aba anônima:
1. `/tasks` → "Gerar com IA" → deve responder
2. `/script` → gerar roteiro → deve responder
3. `/tools` → qualquer ferramenta → deve responder
4. `/` (dashboard) → "Gerar sugestões com IA" no Guia do Dia → deve responder

## Se ainda falhar depois do deploy

Cole o output dos comandos 2 e 4 aqui que eu identifico exatamente onde travou — os 3 cenários possíveis e suas correções já estão mapeados:

| Sintoma | Causa | Correção |
|---|---|---|
| `grep` do passo 2 não acha `LOVABLE_API_KEY` | `git pull` não trouxe o commit novo | `git fetch && git reset --hard origin/main` |
| Logs ainda mostram `Missing required` | Container está com cache antigo de Deno | `docker compose down functions && docker compose up -d functions` |
| Logs limpos mas IA ainda falha no app | Erro em outra function — diagnóstico cirúrgico via `docker compose logs functions --tail 200` filtrando pela function da aba que falhou |

## O que NÃO muda

- Nenhum arquivo de IA (`generate-script`, `generate-daily-guide`, `generate-tools-content`) foi tocado
- Nenhum schema, RLS, frontend, auth ou pagamento mudou
- Reversível em segundos com `git reset --hard <sha-anterior>`

