

# Plano: voltar o login a funcionar destravando o Kong na VPS

## Diagnóstico real

O print mostra `CORS error` na chamada `POST /auth/v1/token?grant_type=password`. Isso **não é bug do código** do app. Significa uma destas 3 coisas, todas do lado da VPS:

1. O container `kong` não está rodando (porque o `docker-compose.yml` está quebrado desde a última edição)
2. O Kong subiu mas com config antiga sem CORS pro domínio do app (`app.influlab.pro` / `lovable.app`)
3. O Kong está rodando mas o GoTrue (`auth`) está fora do ar

O frontend (`src/integrations/supabase/client.ts`) está correto: aponta pra `https://api.influlab.pro` com a anon key certa. **Não vou mexer no código do app.**

## O que vou fazer no repo

Nada de código do app. O problema é 100% infra na VPS. Mas vou criar **uma ferramenta de diagnóstico** que você roda na VPS pra eu ver exatamente o que está quebrado, sem precisar adivinhar mais.

### Arquivo novo: `scripts/diagnose-selfhost.sh`

Script de diagnóstico read-only que roda na VPS e me mostra de uma vez:

1. Status de cada container Supabase (`docker compose ps`)
2. Se o `docker-compose.yml` é válido (`docker compose config -q`)
3. Últimas 30 linhas de log de `kong`, `auth`, `functions`
4. Resposta HTTP do preflight CORS:
   ```bash
   curl -i -X OPTIONS https://api.influlab.pro/auth/v1/token \
     -H "Origin: https://app.influlab.pro" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: authorization,apikey,content-type"
   ```
5. Resposta HTTP de `GET /auth/v1/health`
6. Versão atual do bloco `kong` no `docker-compose.yml` (linhas 14-110)

Tudo formatado, com cabeçalhos claros, pra você colar a saída e eu ver o estado real.

## O que você vai rodar na VPS

```bash
cd /root/app && git pull origin main
chmod +x scripts/diagnose-selfhost.sh
./scripts/diagnose-selfhost.sh > /tmp/diag.txt 2>&1
cat /tmp/diag.txt
```

Depois você cola a saída aqui. Com base nela eu te entrego em **um único snippet** o conserto do Kong (YAML corrigido + comando de up).

## Por que isso vai resolver

- A última tentativa de mexer no `docker-compose.yml` deixou o YAML inválido (`yaml: line 85, column 20: mapping values are not allowed`)
- Enquanto o YAML estiver inválido, **nenhum** `docker compose` funciona — nem restart, nem ps, nem nada
- Ao mesmo tempo, os containers ainda rodam a versão antiga em memória, mas qualquer coisa que dependesse de uma mudança recente (ex: secrets adicionados, CORS atualizado) está fora
- O CORS error no login é o sintoma de que o Kong não está aceitando o domínio do app

Sem ver o estado atual de `/root/supabase/docker/docker-compose.yml` linhas 70-110, qualquer correção minha é chute. O script de diagnóstico te dá tudo de uma vez.

## Arquivos alterados

- `scripts/diagnose-selfhost.sh` (novo) — diagnóstico read-only, não muda nada na VPS

## Arquivos NÃO alterados

- Frontend, edge functions, schema, `client.ts`, `.env` — tudo correto
- Não vou tentar adivinhar o YAML da VPS antes de ver o estado real

## Próximos passos depois do diagnóstico

Com a saída do diagnóstico em mãos, no próximo turno eu te entrego:
1. Bloco YAML corrigido para colar no `docker-compose.yml`
2. Comando `docker compose up -d --force-recreate kong auth functions`
3. `curl` final de validação confirmando que login voltou

Hoje à noite você não precisa fazer mais nada além de rodar o script e colar a saída. Amanhã com a cabeça fresca a gente fecha em 1 ciclo.

