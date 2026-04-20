

## Problema

Geração com IA na tela **Tarefas** (`generate-daily-guide`) demora muito e falha. Causa raiz: schema de tool calling grande (7 categorias + 7 sub-arrays = ~50 strings) + Gemini 2.5 Flash + sem timeout/retry no fetch + sem feedback de progresso.

## Plano de correção

### 1. Adicionar timeout explícito + retry em `generate-daily-guide`

Envolver o `fetch` da Gemini em `AbortController` com timeout de 90s. Se der timeout ou 5xx, retry uma vez automaticamente. Hoje fica pendurado até morrer sem aviso.

### 2. Reduzir tamanho do payload de saída

O schema pede **50 strings** numa só chamada. Vou cortar para o essencial sem perder UX:
- Manter as 6 categorias principais (5 itens cada = 30 strings)
- `taskExamples`: reduzir de 5 para 3 exemplos por tarefa (7 × 3 = 21 strings em vez de 35)

Isso corta ~30% do tempo de geração e do risco de truncamento.

### 3. Trocar modelo desta function pra `gemini-2.5-flash-lite` OU manter `flash` com prompt enxuto

Recomendo manter `gemini-2.5-flash` mas enxugar o `visceralContext` (hoje despeja 15+ campos do avatar — é overkill pra gerar exemplos de tarefa). Reduzir pra 6 campos chave (avatar, ultimateFear, deepOccultDesire, coreWounds, verbalTriggers, frustrations).

### 4. Mensagens de erro mais claras no front

No `DailyGuide.tsx` (e onde chama a function): se `AbortError` ou erro 504/500, mostrar toast "A IA está demorando mais que o normal. Tente novamente em alguns segundos." em vez de erro genérico.

### 5. Aplicar mesmo padrão (timeout + retry) em `generate-tools-content`

Mesma vulnerabilidade. Mesmo fix.

## O que NÃO muda

- `generate-audience-profile` permanece em `gemini-2.5-pro` (decisão anterior, não é o problema atual)
- `ai-chat`, `generate-script`, `generate-personalized-matrix` — não tocaremos agora
- Schema do banco
- Frontend de Tarefas/Tools (só ajuste de toast)

## Arquivos afetados

- `supabase/functions/generate-daily-guide/index.ts` — timeout+retry, prompt enxuto, schema reduzido
- `supabase/functions/generate-tools-content/index.ts` — timeout+retry
- `src/components/DailyGuide.tsx` — toast de erro melhor (a confirmar arquivo após investigar)

## Deploy no self-hosted ⚠️

Lovable atualiza o código aqui, mas você precisa redeployar no `api.influlab.pro`:

```bash
cd ~/supabase/docker && docker compose restart functions
```

## Validação

1. Tela **Tarefas** → clica "gerar com IA" → deve responder em 15-30s consistentemente
2. Se falhar, toast claro aparece e botão volta ao estado clicável
3. Conferir logs:
   ```bash
   docker compose logs functions --tail 100 | grep -E "generate-daily-guide|generate-tools-content"
   ```

## Decisão alternativa (não recomendo agora)

Migrar pra padrão **job assíncrono** (`EdgeRuntime.waitUntil` + tabela de fila + polling no front). Funciona mas é uma refatoração bem maior — só vale se mesmo após o fix acima a UX continuar ruim.

