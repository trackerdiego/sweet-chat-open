

# Diagnóstico FECHADO — não é seu código, é o Gemini caindo (503)

## A verdade revelada pelos logs

Os logs mataram TODAS as hipóteses anteriores. Olha o padrão idêntico nas duas functions:

```
[daily-guide] gemini responded { status: 503, latencyMs: 2122 }
[generate-script] gemini responded { status: 503, latencyMs: 3885 }
[generate-script] gemini responded { status: 503, latencyMs: 1150 }
```

**Tudo que descartamos:**
- ❌ Não é timeout (latência de 1-4 segundos, não 300s)
- ❌ Não é truncamento de `max_tokens`
- ❌ Não é Kong, edge-runtime, volume, código, prompt, parser
- ❌ Não é `daily-guide` "estruturalmente quebrada"

**O que realmente está acontecendo:**
- ✅ Google Gemini API está retornando **HTTP 503** (Service Unavailable) na chamada principal **E** no retry
- ✅ Acontece em ambas as functions (mesma chave, mesma API)
- ✅ Tools funciona "às vezes" porque às vezes o Gemini responde — é roleta

O motivo de "Tools às vezes ✅, Script às vezes ✅, Daily Guide nunca ✅" é apenas **frequência de tentativa**: você testou Daily Guide poucas vezes seguidas, todas pegaram momento ruim.

## Causa raiz do 503

Três possibilidades, em ordem de probabilidade:

1. **Cota/rate-limit do Gemini free tier estourado** — modelo `gemini-2.5-flash` no free tier tem limite agressivo de RPM e RPD. 503 com retry imediato também 503 = bloqueio sustentado, não pico.
2. **Modelo `gemini-2.5-flash` saturado regionalmente** — Google às vezes degrada modelos específicos. Outros modelos (ex: `gemini-2.0-flash`) podem estar OK.
3. **API key sem billing ativado** — chave funciona pra requisições leves mas o Google retorna 503 quando atinge tier gratuito em produção real.

## Plano de correção (camadas em ordem)

### Camada 1 — Backoff exponencial + 2º retry (resolve picos)
Hoje o código tenta 1x, falha 503, tenta 1x de novo (sem espera), falha 503, desiste. Vou:
- Aumentar pra **3 tentativas**
- Esperar **1s, 3s, 7s** entre elas (exponencial com jitter)
- Tratar 503/429/500/502/504 como retriable
- Logar tentativa atual

Isso já resolve a maioria dos picos transitórios do Gemini.

### Camada 2 — Fallback de modelo (resolve degradação regional)
Se as 3 tentativas em `gemini-2.5-flash` falharem, **automaticamente cair pra `gemini-2.0-flash`** (modelo estável e amplamente disponível). Mesma API key, mesmo endpoint OpenAI-compatible, só muda o `model:`.

### Camada 3 — Mensagem clara pro usuário (UX)
Quando TODAS as tentativas + fallback falharem, retornar erro com mensagem específica:
> "O serviço de IA do Google está instável agora (Gemini 503). Aguarde 1-2 minutos e tente novamente."
Em vez do genérico "demorando mais que o normal".

### Camada 4 — Diagnóstico definitivo da causa (ação sua, paralela)
Você precisa confirmar **qual** das 3 causas é a sua. Ações:
1. **Ver o body completo do 503** — o erro do Google sempre traz mensagem (`"RESOURCE_EXHAUSTED"` = cota, `"UNAVAILABLE"` = degradação). Comando pra você rodar na VPS me passar:
   ```bash
   docker compose logs functions --since 10m 2>&1 | grep -A 10 "gemini error" | tail -40
   ```
2. **Checar billing/cota no Google AI Studio**: https://aistudio.google.com/app/apikey → ver se sua chave tem billing habilitado e qual o limite atual.

## Arquivos que vou tocar

Apenas 3 edge functions (mesma mudança nas três):
- `supabase/functions/generate-script/index.ts` — função `callGeminiWithRetry` (linhas ~37-69)
- `supabase/functions/generate-daily-guide/index.ts` — função `callGeminiWithRetry` (linhas ~33-65)
- `supabase/functions/generate-tools-content/index.ts` — adicionar mesma função (vou ler primeiro pra confirmar estrutura)

Mudança em cada uma:
1. Substituir `callGeminiWithRetry` por versão com 3 tentativas + backoff exponencial
2. Adicionar fallback automático pra `gemini-2.0-flash` se `gemini-2.5-flash` falhar 3x
3. Mensagem de erro 503 mais clara

Nenhuma mudança em DB, nenhuma mudança em frontend.

## Deploy depois das mudanças

Como é self-hosted, vou entregar bloco copia-e-cola pra VPS no final:
```bash
cd /root/app && git pull && ./scripts/deploy-selfhost.sh
```

## O que NÃO vou fazer

- Mexer em volume, Kong, compose (nada disso é o problema)
- Aumentar `max_tokens` (irrelevante, 503 é antes do output)
- Mudar prompt do daily-guide (o prompt está OK)
- Trocar pro Lovable AI Gateway (você usa chave Gemini direta intencionalmente — manteremos)

## Resultado esperado

Após o deploy:
- **Tools**: continua estável + ainda mais resiliente
- **Script**: deve passar de "às vezes" pra "quase sempre"
- **Daily Guide**: deve passar de "nunca" pra "quase sempre"
- Erros restantes terão mensagem clara identificando que é problema do Google

Se ainda assim falhar consistentemente após o patch, a causa é **cota** (camada 4 acima) e a única solução real é habilitar billing no Google AI Studio.

## Memória a atualizar

`mem://infra/deploy-workflow.md` — adicionar nota:
> Edge functions de IA (script, daily-guide, tools) usam retry exponencial 3x + fallback `gemini-2.5-flash` → `gemini-2.0-flash` para sobreviver a 503 do Gemini.

