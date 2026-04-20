

# Diagnóstico: o que está rodando onde + por que `daily-guide` nunca funciona

## Resposta direta da sua dúvida

**Tudo já está rodando 100% no self-hosted (`api.influlab.pro`)**, nada mais toca o Lovable Cloud.

Prova: o `src/integrations/supabase/client.ts` aponta hardcoded pra `https://api.influlab.pro`. As próprias screenshots que você mandou mostram os erros vindo de `api.influlab.pro/functions/v1/generate-script` e `/generate-tools-content`. Lovable Cloud nem está mais no caminho.

Então o que você está vendo (Tools quase sempre OK, Script intermitente, Daily Guide nunca) é **comportamento real do self-hosted depois dos patches** (Kong 300s + edge-runtime 300s + Promise.all).

## Leitura dos sintomas

| Function | Status | O que isso significa |
|---|---|---|
| `generate-tools-content` | Quase sempre OK, falha eventual | Prompt curto/médio, Gemini responde em 15-40s. Eventual 502 = cold start ou Gemini lento pontual. **Aceitável.** |
| `generate-script` | Intermitente | Prompt mais longo (analisa nicho + gera roteiro completo). Latência beira o limite. Quando Gemini demora >2-3min, estoura. |
| `generate-daily-guide` | **Nunca funciona** | Padrão diferente. Não é timeout aleatório — é falha **consistente**. Provavelmente erro de runtime, não de tempo. |

O fato de `daily-guide` **nunca** funcionar (não "às vezes") indica que o problema dela é **outro**, não o mesmo timeout que afeta `script`. Pode ser: payload mal formado, falta de coluna no DB, prompt que sempre gera resposta fora do schema esperado, ou erro de parse do retorno.

## Plano de investigação

### Passo 1 — Ler o código atual de `generate-daily-guide` (read-only)
Eu vou inspecionar `supabase/functions/generate-daily-guide/index.ts` pra ver:
- Estrutura do prompt e tamanho esperado da resposta
- Se tem `Promise.all` ou ainda faz queries em série (você falou que aplicou nas 3, mas vou confirmar)
- Schema de validação da resposta (se tem `try/catch` no `JSON.parse` que mascara erro real)
- Tabelas/colunas que ele lê e escreve

### Passo 2 — Pedir log específico da VPS (1 comando focado)
Você roda **depois** de tentar abrir o guia diário no app:

```bash
docker compose logs functions --since 3m 2>&1 | grep -iE "daily-guide" -A 3 | tail -100
```

Esse comando puxa toda linha que cita `daily-guide` + as 3 linhas seguintes (contexto). Vou ver o erro **exato** que está acontecendo.

### Passo 3 — Comparar com `generate-script`
Mesmo comando trocando `daily-guide` por `generate-script`, pra ver a diferença de comportamento entre uma function que funciona às vezes e uma que nunca funciona.

### Passo 4 — Diagnóstico definitivo
Com base nos logs:
- **Se for erro de schema/parse** → corrijo o prompt/parser na function (mudança de código + redeploy via `deploy-selfhost.sh`)
- **Se for timeout puro** (latência consistente >5min) → reduzo `max_tokens` do daily-guide ou simplifico o prompt
- **Se for erro de DB** (coluna faltando) → SQL pra você rodar no Studio self-hosted
- **Se for OOM** (worker morto por memória) → ajuste `mem_limit` no compose

### Passo 5 — Estabilizar `generate-script`
Mesma lógica: ler logs, identificar gargalo, atacar. Provavelmente Gemini com `max_tokens` alto demais — solução é dividir em 2 chamadas ou reduzir tokens.

## O que NÃO vou fazer agora

- Mexer em config da VPS (já está tudo aplicado)
- Mudar caminho de volume (já confirmado correto)
- Tocar em `generate-tools-content` (está aceitável)

## Próximo passo

Após sua aprovação:
1. Eu leio `generate-daily-guide/index.ts` e `generate-script/index.ts` em modo default
2. Você roda os 2 comandos de log da VPS (passos 2 e 3) e cola o output
3. Eu fecho o diagnóstico e entrego: ou patch de código + bloco da VPS, ou SQL pro Studio

