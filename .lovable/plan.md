

# Diagnóstico real: por que está demorando absurdamente E falhando

## O que está acontecendo

A etapa 1 ("Analisando seu público") está dando erro depois de **muito tempo de espera**. Olhando o código com atenção, a causa é matemática:

### Tempo máximo da etapa 1, hoje

```text
callGeminiNative (gemini-2.5-pro):
  attempt 1: até 55s timeout + 2s sleep
  attempt 2: até 55s timeout + 5s sleep  
  attempt 3: até 55s timeout + 12s sleep
  → primary esgotado: até 184s

  fallback (gemini-2.5-flash):
  attempt 1: até 55s + 2s
  attempt 2: até 55s + 5s
  attempt 3: até 55s + 12s
  → fallback esgotado: até 184s

TOTAL TEÓRICO POR ETAPA: até 368s = 6 minutos
```

Mas o **Supabase Edge Functions tem timeout duro de 150s** (e gateways intermediários geralmente cortam antes — 60-120s). Então o que acontece na prática:

1. Frontend chama `generate-audience-profile` (step=description)
2. Função entra no retry loop do `gemini-2.5-pro`
3. `gemini-2.5-pro` está lento/instável → timeout de 55s na primeira tentativa
4. Retry 2 com mais 55s de timeout → gateway corta a request inteira em ~120-150s
5. Frontend recebe **erro de rede** (não erro estruturado da função)
6. Card vira vermelho com "Tentar novamente"
7. Usuário clica → repete o mesmo ciclo de 2 minutos → mesmo erro

## A causa raiz: insistência no `gemini-2.5-pro` com retries longos

`gemini-2.5-pro` é **lento e instável** — facilmente passa de 30-50s por chamada e tem alta taxa de 503. O retry loop atual, ao invés de cair rápido para o `flash`, fica preso tentando 3x o `pro` antes de desistir. E quando finalmente cai pro `flash`, o gateway já matou a request.

Você mesmo confirmou na conversa: *"se eu jogar o prompt no Gemini direto ele responde em segundos"* — porque você está usando o modelo rápido. O `2.5-pro` **não é rápido**, e o app está apostando no produto errado.

## Solução

### 1. Reduzir drasticamente o retry budget no `_shared/gemini.ts`

```text
ANTES: pro → 3 retries × 55s = 165s, depois flash → 3 retries × 55s = 165s
DEPOIS: pro → 1 tentativa × 35s, depois flash → 2 tentativas × 30s
        Total máximo: 35 + 30 + 30 + ~7s sleep = ~102s (dentro do gateway)
```

Mudanças em `callGeminiNative`:
- Novo parâmetro opcional `primaryAttempts` (default 3, mas vamos passar 1 nas funções críticas)
- Novo parâmetro opcional `fallbackAttempts` (default 3, vamos passar 2)
- Sleeps reduzidos: `[1500, 3000]` em vez de `[2000, 5000, 12000]`
- Detectar `AbortError` (timeout) e **pular direto pro fallback** em vez de re-tentar o primary

### 2. Trocar o modelo padrão para `gemini-2.5-flash`

Em `generate-audience-profile/index.ts` (steps description e avatar) e `generate-personalized-matrix/index.ts`:

```text
ANTES: model: "gemini-2.5-pro", fallbackModel: "gemini-2.5-flash"
DEPOIS: model: "gemini-2.5-flash", fallbackModel: "gemini-2.5-flash-lite"
```

**Justificativa:** o `2.5-flash` produz qualidade muito próxima do `pro` para prompts estruturados (responseSchema), com latência 5-10x menor e estabilidade muito maior. Para descrição de público em texto livre e matriz com schema rígido, é a escolha correta. O `2.5-pro` faz sentido para raciocínio complexo de várias páginas — não é o caso aqui.

### 3. Timeout por chamada reduzido

```text
ANTES: timeoutMs: 55000 (cada tentativa)
DEPOIS: timeoutMs: 35000 no primary, 30000 no fallback
```

Com `flash` como primary, 35s é mais que suficiente — 95% das chamadas respondem em <15s.

### 4. Tempo total esperado por etapa

```text
description: ~12-25s (era até 184s)
avatar:      ~15-30s (era até 184s)
matrix:      ~40-60s (4 semanas em paralelo, cada uma com flash rápido)

TOTAL onboarding: ~70-115s (era até ~9 minutos)
```

### 5. Mensagens de erro mais úteis

Quando a função falha, o frontend hoje mostra apenas "Tentar novamente". Vou adicionar:
- Se erro = timeout → "A IA está sobrecarregada agora. Aguarde 30s e tente."
- Se erro = 429 → "Muitas requisições. Aguarde 1 minuto."
- Se erro = 503 → "Serviço temporariamente indisponível. Tente novamente."

Isso dá ao usuário ideia do que está acontecendo em vez de tentar imediatamente de novo (o que piora o problema).

## Arquivos modificados

- `supabase/functions/_shared/gemini.ts` — adiciona `primaryAttempts`/`fallbackAttempts`, reduz sleeps, salta direto pro fallback em timeout
- `supabase/functions/generate-audience-profile/index.ts` — troca pro flash + reduz timeout + 1 retry primary, 2 fallback
- `supabase/functions/generate-personalized-matrix/index.ts` — mesma troca + ajustes
- `src/pages/Onboarding.tsx` — mensagens de erro contextuais por código

## Deploy

Como **edge functions mudam**, você precisa rodar:

```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh
```

ou simplesmente:

```bash
cd /root/app && git pull origin main && docker compose -f /root/supabase/docker/docker-compose.yml restart functions
```

Frontend (Vercel) faz auto-deploy do mesmo push.

## Garantia

Mesmo que `gemini-2.5-flash` ainda dê instabilidade pontual, o `flash-lite` como fallback responde em <8s consistentemente. O usuário **nunca mais vai esperar 2 minutos por uma falha**. Pior caso: 35s + 30s = 65s e ele ou tem resposta ou tem erro claro com mensagem útil.

