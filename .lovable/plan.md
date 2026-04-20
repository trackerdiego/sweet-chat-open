

# 502/504 ainda acontecendo — duas camadas além do Kong

## Análise dos novos logs

Os logs mostram um padrão revelador:
- Várias chamadas **504 Gateway Timeout** (timeout puro)
- Várias **502 Bad Gateway** (worker morreu / resposta vazia)
- O 502 nunca tinha aparecido antes — só apareceu depois do patch do Kong

**O 502 prova que o problema NÃO é mais o Kong.** Se fosse Kong cortando, seria sempre 504. O 502 vem do **edge-runtime devolvendo resposta vazia** — ou seja, o worker está morrendo no meio da request, antes de devolver qualquer coisa.

## Causa raiz: 3 camadas de timeout, todas mal configuradas

| Camada | Timeout atual | Problema |
|---|---|---|
| Kong (gateway) | 300s ✅ | resolvido |
| **edge-runtime worker** | **default ~150s, mas no self-hosted geralmente 60s** | ⚠️ provável culpado dos 502 |
| Função interna (Gemini fetch) | 60s + retry = até 120s | OK |
| Lovable Cloud client (`functions.invoke`) | timeout próprio | OK |

O **edge-runtime** tem variáveis `EDGE_RUNTIME_PER_REQUEST_DEADLINE_MS` e `EDGE_RUNTIME_WORKER_TIMEOUT_MS` que, no Supabase self-hosted default, ficam em **60s**. Quando o Gemini demora 70s+ (acontece com prompts grandes + visceral profile), o worker é morto pelo runtime ANTES do Kong, e o Kong devolve 502 pra você.

Além disso, há um problema de **arquitetura**: as 3 IAs fazem várias coisas em sequência ANTES da chamada Gemini:
1. `auth.getUser()` → vai no auth (~200ms)
2. Buscar `user_usage` (~150ms)
3. Buscar `audience_profiles` (~150ms)
4. Construir prompt (~10ms)
5. Chamar Gemini (~30-90s)

Quando Gemini sozinho dá 70s, o total fica 71s e estoura o worker timeout default de 60s.

## Plano de correção em 2 frentes

### Frente A — VPS: aumentar deadline do edge-runtime worker (resolve 502)

Adicionar 2 env vars no service `functions` do `docker-compose.yml`:
```
EDGE_RUNTIME_WORKER_TIMEOUT_MS: 300000
EDGE_RUNTIME_PER_REQUEST_DEADLINE_MS: 300000
```

E no `.env`:
```
EDGE_RUNTIME_WORKER_TIMEOUT_MS=300000
EDGE_RUNTIME_PER_REQUEST_DEADLINE_MS=300000
```

Depois `docker compose up -d --force-recreate functions`.

### Frente B — Código: paralelizar buscas antes do Gemini (ganha 300-500ms)

Nas 3 functions (`generate-script`, `generate-daily-guide`, `generate-tools-content`), trocar:
```ts
const { data: usageData } = await adminClient.from("user_usage")...
const { data: audienceData } = await supabaseAuth.from("audience_profiles")...
```

Por:
```ts
const [usageRes, audienceRes] = await Promise.all([
  adminClient.from("user_usage").select(...).eq(...).maybeSingle(),
  supabaseAuth.from("audience_profiles").select(...).eq(...).maybeSingle(),
]);
```

Não é muito, mas todo segundo conta perto do limite.

### Frente C — Reduzir tamanho do prompt do `generate-daily-guide` (mais lento dos 3)

O `generate-daily-guide` pede **7 categorias com 5 itens cada + objeto `taskExamples` com 7 chaves de 5 itens** = ~70 strings na resposta. Isso é o que mais demora.

Proposta: separar `taskExamples` em chamada **opcional/lazy** ou reduzir pra 3 itens por categoria. Como mexer nessa estrutura pode quebrar o frontend, vou só **logar o tempo gasto** primeiro pra confirmar o gargalo, sem mudar o schema agora.

### Frente D — Validação real (com JWT)

Depois do deploy, vou usar `supabase--curl_edge_functions` (que pega seu JWT do preview) pra chamar `generate-script` direto e ver se retorna 200 ou continua 502/504, com a latência exata.

## Arquivos que vou tocar

| Arquivo | Mudança | Risco |
|---|---|---|
| `supabase/functions/generate-script/index.ts` | `Promise.all` nas 2 queries | baixo |
| `supabase/functions/generate-daily-guide/index.ts` | `Promise.all` + log de latência por etapa | baixo |
| `supabase/functions/generate-tools-content/index.ts` | `Promise.all` + log de latência por etapa | baixo |

## O que VOCÊ vai precisar rodar na VPS (bloco copia-e-cola)

```bash
cd ~/supabase/docker

# 1. Adiciona os 2 timeouts no .env (se já existirem, atualiza)
grep -q "EDGE_RUNTIME_WORKER_TIMEOUT_MS" .env || echo "EDGE_RUNTIME_WORKER_TIMEOUT_MS=300000" >> .env
grep -q "EDGE_RUNTIME_PER_REQUEST_DEADLINE_MS" .env || echo "EDGE_RUNTIME_PER_REQUEST_DEADLINE_MS=300000" >> .env

# 2. Adiciona as 2 vars no environment do service functions
python3 <<'PY'
import re
p = "docker-compose.yml"
s = open(p).read()
# acha o bloco do service "functions" e injeta as env vars no environment:
def patch(m):
    block = m.group(0)
    if "EDGE_RUNTIME_WORKER_TIMEOUT_MS" in block:
        return block
    return block.replace(
        "environment:",
        "environment:\n      EDGE_RUNTIME_WORKER_TIMEOUT_MS: ${EDGE_RUNTIME_WORKER_TIMEOUT_MS}\n      EDGE_RUNTIME_PER_REQUEST_DEADLINE_MS: ${EDGE_RUNTIME_PER_REQUEST_DEADLINE_MS}",
        1
    )
s = re.sub(r"  functions:\n[\s\S]*?(?=\n  [a-z]+:\n|\Z)", patch, s)
open(p, "w").write(s)
print("docker-compose.yml patched")
PY

# 3. Pull do código novo + sync (SEM --delete!) + recreate
cd /root/app && git pull origin main
rsync -av /root/app/supabase/functions/ ~/supabase/docker/volumes/functions/
cd ~/supabase/docker && docker compose up -d --force-recreate functions

sleep 6
docker compose logs functions --since 30s 2>&1 | grep -iE "main function started|boot error" | tail -5
```

## O que NÃO vou fazer

- Não vou implementar fila assíncrona / polling — ainda dá pra resolver com timeout
- Não vou trocar Gemini 2.5-flash
- Não vou tocar em `main/`, `hello/`, Kong (já patchado)
- Não vou mudar o schema do `daily-guide` agora — primeiro mede, depois decide

## Próximo passo

Quando aprovar:
1. Aplico `Promise.all` nas 3 functions
2. Te entrego o bloco da VPS acima
3. Você roda e me confirma `main function started` sem boot error
4. Eu testo `generate-script` via `supabase--curl_edge_functions` com seu JWT
5. Se der 200 → fechamos e atualizo memória com as 2 env vars críticas
6. Se ainda der 502/504 → eu vejo a latência exata no log e ataco o passo seguinte

