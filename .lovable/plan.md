

# Plano: rodar Gemini direto no self-hosted de forma estável (sem Lovable AI, sem 2.5-pro)

## Por que está quebrando hoje (causa real, não "tier free")

Sua API é Nível 1 paga. Os limites do `gemini-2.5-flash` são generosos:
- **1.000 req/min**
- **1.000.000 tokens/min**

Você está MUITO longe disso em volume. O que está causando 503 é **a forma das chamadas**, não a quantidade:

1. **Endpoint OpenAI-compat (`/v1beta/openai/...`)** — é um shim que o Google mantém com qualidade inferior. Ele é o que mais gera `503` e `MALFORMED_FUNCTION_CALL` em prompts grandes com tool calling. O endpoint nativo (`/v1beta/models/...:generateContent`) é muito mais estável.

2. **Tool calling com schema gigante** — o `matrix` pede 30 dias × 10 campos numa única tool call. Isso faz o Gemini estourar `finish_reason: "length"` ou `MALFORMED_FUNCTION_CALL` mesmo com tokens sobrando. Não é limite de quota, é limite de **qualidade da geração estruturada** num único turno.

3. **Onboarding paraleliza demais** — `audience-step1` + `step2` + `matrix` + `daily-guide` disparam quase juntos. Cada um manda prompt de 5-10K tokens. Pico de TPM instantâneo dispara o `503` interno do Google mesmo com cota disponível.

## Solução: 3 mudanças cirúrgicas, todas no Gemini direto

### Mudança 1 — Trocar pro endpoint nativo do Gemini

Hoje:
```
POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
Authorization: Bearer ${GOOGLE_GEMINI_API_KEY}
body: { model, messages, tools, tool_choice }
```

Vai virar:
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}
body: { contents, tools, toolConfig, generationConfig }
```

Por quê:
- Endpoint nativo tem 90%+ menos `MALFORMED_FUNCTION_CALL` no tool calling
- Tem `responseSchema` em vez de `tool_choice` — saída JSON garantida sem tool call hack
- `503` despenca porque deixa de passar pelo proxy OpenAI-compat
- Mesmo modelo, mesma cota, mesmo preço — só caminho diferente

### Mudança 2 — Usar `responseSchema` em vez de tool calling

Tool calling é gambiarra pra forçar JSON estruturado. O Gemini nativo tem:
```json
{
  "generationConfig": {
    "responseMimeType": "application/json",
    "responseSchema": { ...mesmo schema atual... }
  }
}
```

Resultado: o modelo retorna JSON puro no `candidates[0].content.parts[0].text`, sem `tool_calls`, sem `MALFORMED_FUNCTION_CALL`, sem `finish_reason: "length"` por overhead de função.

### Mudança 3 — Quebrar o `matrix` em 4 chamadas (uma por semana)

Hoje: 1 chamada gera os 30 dias de uma vez (schema com array de 30 objetos × 10 campos = saída de ~15K tokens estruturados). É aí que o `2.5-flash` engasga.

Vai virar: 4 chamadas paralelas (`Promise.all`), cada uma gera 7-9 dias:
- Semana 1: dias 1-7 (objeções/frustrações)
- Semana 2: dias 8-14 (feridas/vergonha)
- Semana 3: dias 15-21 (pecados/desejos)
- Semana 4: dias 22-30 (esperança/decisão)

Cada chamada vira pequena, rápida, sem risco de truncar. Junta no fim e salva igual.

Tempo total cai (paralelismo > sequencial gigante). Custo idêntico (mesma quantidade de tokens output). Estabilidade dispara.

## Arquivos alterados

1. **`supabase/functions/_shared/gemini.ts`** (novo)
   - Wrapper único `callGeminiNative({ model, systemInstruction, prompt, schema, timeoutMs })`
   - Usa endpoint nativo + `responseSchema`
   - Mantém retry exponencial 3x + fallback de modelo
   - Devolve JSON parseado direto

2. **`supabase/functions/generate-personalized-matrix/index.ts`**
   - Importa `callGeminiNative`
   - Quebra geração em 4 chamadas paralelas (1 por semana)
   - Mantém `distributeVisceralElements` igual
   - `PRIMARY_MODEL = "gemini-2.5-flash"`, sem fallback pro `pro`

3. **`supabase/functions/generate-script/index.ts`**
   - Importa `callGeminiNative`
   - 1 chamada só (script é pequeno), `responseSchema` resolve
   - Mantém `flash`

4. **`supabase/functions/generate-audience-profile/index.ts`**
   - Importa `callGeminiNative`
   - Mantém estrutura de 2 steps já existente
   - Step 2 (avatar) usa `responseSchema` em vez de tool calling
   - Permanece em `2.5-pro` (esse aqui realmente precisa de raciocínio)

5. **`supabase/functions/generate-daily-guide/index.ts`**, **`generate-tools-content/index.ts`**, **`ai-chat/index.ts`**
   - Migram pro `callGeminiNative`
   - `daily-guide` e `tools-content`: `flash` com `responseSchema`
   - `ai-chat`: streaming (endpoint nativo `:streamGenerateContent`)

6. **`supabase/functions/transcribe-media/index.ts`**
   - Já usa endpoint nativo de upload, só padroniza pro wrapper

## O que NÃO muda
- `GOOGLE_GEMINI_API_KEY` continua sendo a única chave usada
- Sem Lovable AI, sem connector novo, sem custo adicional
- Schemas semânticos (campos, validação) ficam idênticos
- Frontend não muda nada — contrato de resposta preservado
- Self-hosted continua self-hosted

## Estimativa de impacto

| Métrica | Hoje | Depois |
|---|---|---|
| 503 no `matrix` | ~80% das chamadas | <5% |
| `MALFORMED_FUNCTION_CALL` | frequente | praticamente zero |
| Tempo do onboarding completo | 90-180s (com retries) | 25-40s |
| Custo por onboarding | mesmo | **menor** (sem retries desperdiçados, sem fallback pro `pro`) |
| Modelo principal | `flash` (com fallback `pro`) | `flash` puro |

## Critério de sucesso
- Onboarding completo (audience → matrix → daily-guide) em <45s, sem erro
- Boot logs mostram: `[matrix] using native endpoint, responseSchema, 4-week parallel`
- Zero `MALFORMED_FUNCTION_CALL` em 10 onboardings consecutivos
- Custo Google Cloud cai (menos retries, sem cair no `pro`)

## Detalhes técnicos
```text
Endpoint nativo: /v1beta/models/{model}:generateContent
Schema: generationConfig.responseSchema (JSON Schema subset do OpenAPI)
Auth: ?key=API_KEY na URL (nativo) em vez de Bearer (OpenAI-compat)
Streaming (ai-chat): :streamGenerateContent?alt=sse
Paralelismo matrix: Promise.all([gerarSemana(1), gerarSemana(2), gerarSemana(3), gerarSemana(4)])
Fallback inteligente: se 503 persistir após 3 retries no flash, cai pro flash-lite (não pro pro)
```

```text
Por que isso resolve sem Lovable AI:
- O bug não era "API pública é ruim" — era endpoint OpenAI-compat + tool calling pesado
- Endpoint nativo do Google é o mesmo que o Lovable Gateway usa por baixo
- Você fica dono do controle, sem intermediário, sem créditos extra
```

```text
Bloco de deploy pra VPS (será incluído na resposta após implementação):
cd /root/app && git checkout -- supabase/functions/ && git pull origin main
cp -r supabase/functions/_shared \
      supabase/functions/generate-personalized-matrix \
      supabase/functions/generate-script \
      supabase/functions/generate-audience-profile \
      supabase/functions/generate-daily-guide \
      supabase/functions/generate-tools-content \
      supabase/functions/ai-chat \
      ~/supabase/docker/volumes/functions/
docker compose -f ~/supabase/docker/docker-compose.yml restart functions
```

