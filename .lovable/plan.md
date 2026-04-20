

# Plano: corrigir falsos erros visuais no onboarding + estabilizar `matrix-week-1` e `matrix-week-4`

## Diagnóstico real (do log que você mandou)

Backend funcionou:
- `audience-profile` rodou Step 1 normal
- `matrix` rodou as 4 semanas em paralelo
- `week 2` OK em 36s
- `week 3` OK em 37s  
- `week 4` OK em 57s (caiu no `flash-lite` depois de 3x 503 — fallback funcionou)
- `week 1` OK em 63s (demorou mais por retries, mas voltou)
- `complete — 30 dias em 63444ms` ✅

Então por que os passos 1 e 2 ficam vermelhos no meio?

**Causa**: o `Onboarding.tsx` provavelmente tem um **timeout no client** (ex: 30s ou 45s) por step. Quando o `matrix` demora 63s, o frontend marca os steps anteriores como "erro" mesmo que o backend tenha terminado tudo. Por isso a matriz aparece correta no fim — o backend nunca falhou, só o indicador visual disparou cedo demais.

**Subcausa**: `week-1` e `week-4` estão tomando 503 em paralelo no Gemini. Hipótese: as 4 chamadas paralelas do `Promise.all` saem **no mesmo milissegundo**, e o Google enxerga isso como burst → throttla 2 das 4. As semanas 2 e 3 passam, 1 e 4 batem 503 (azar do dado).

## Solução em 2 frentes

### Frente A — corrigir o falso erro visual no onboarding

Investigar `src/pages/Onboarding.tsx` e ver:
- Como cada passo é marcado como "erro" (cor vermelha)
- Se existe algum `setTimeout` ou `Promise.race` que mata o step antes do backend responder
- Se o estado de erro do step depende do estado de outro step ainda em execução

Correção provável (uma das três, decido depois de ler o código):
1. Remover qualquer timeout client-side por step (deixar o backend mandar) **OU**
2. Ampliar timeout pra 120s **OU**
3. Trocar a lógica: step só vira "erro" se a edge function retornar erro HTTP, nunca por timer local

### Frente B — eliminar os 503 das semanas paralelas

Mudança cirúrgica em `supabase/functions/generate-personalized-matrix/index.ts`:

**Stagger das 4 chamadas em vez de `Promise.all` puro.** Disparar com 800ms de espaçamento entre cada uma:

```ts
// em vez de Promise.all([w1, w2, w3, w4])
const results = await Promise.all(
  WEEKS.map((week, i) => 
    new Promise(r => setTimeout(r, i * 800)).then(() => callGeminiNative({...}))
  )
);
```

Por quê:
- Continua paralelo (não vira sequencial)
- Mas não dispara as 4 no mesmo ms — Google aceita melhor
- Custo do stagger: +2.4s no total (irrelevante quando estamos em ~60s)
- Espera reduzir 503 de ~50% pra <10%

**Aumentar delays de retry** no `_shared/gemini.ts`:
- Hoje: `[1000, 3000, 7000]` ms entre tentativas
- Depois: `[2000, 5000, 12000]` ms
- Por quê: 503 do Gemini volta ao normal em 5-15s. Esperar mais ajuda mais que retry rápido.

## Arquivos alterados

1. **`src/pages/Onboarding.tsx`** — remover timeout client-side ou ampliar pra 120s; garantir que erro só aparece em resposta HTTP de erro
2. **`supabase/functions/generate-personalized-matrix/index.ts`** — adicionar stagger de 800ms entre as 4 semanas
3. **`supabase/functions/_shared/gemini.ts`** — aumentar delays de retry pra `[2000, 5000, 12000]`

## O que NÃO muda
- Nenhum prompt
- Nenhum schema
- Lógica de fallback `flash → flash-lite` continua igual
- Frontend visual (só lógica de marcar erro)

## Critério de sucesso
- Passos 1, 2, 3, 4 ficam **verdes em sequência**, sem nenhum voltar pra vermelho
- Logs continuam mostrando `[matrix] complete — 30 dias em XXms`
- 503 nas semanas paralelas cai pra < 1 a cada 10 onboardings
- Onboarding completo percebido pelo usuário em <90s sem nenhum erro visual

## Bloco de deploy pra VPS (será incluído após implementação)
```bash
cd /root/app && git checkout -- supabase/functions/ src/ && git pull origin main
cp -r supabase/functions/_shared/. ~/supabase/docker/volumes/functions/_shared/
cp -r supabase/functions/generate-personalized-matrix/. ~/supabase/docker/volumes/functions/generate-personalized-matrix/
docker compose -f ~/supabase/docker/docker-compose.yml restart functions
```
Frontend (Vercel) sobe sozinho via push do GitHub — não precisa fazer nada na VPS pra ele.

## Detalhes técnicos
```text
Por que os steps 1 e 2 ficavam vermelhos:
- Backend nunca falhou neles (logs comprovam: Step 1 rodou, matrix rodou inteiro)
- Frontend tem provavelmente Promise.race com timeout, ou estado de "erro" derivado
  de outro step que demorou demais
- Vou ler Onboarding.tsx pra confirmar a causa exata e remover

Por que week-1 e week-4 batem 503:
- Promise.all dispara 4 fetch() no mesmo event loop tick
- Google enxerga 4 requests no mesmo ms da mesma key = parece burst suspeito
- Stagger 800ms resolve sem perder paralelismo real

Por que aumentar delay de retry:
- 503 do Gemini é "back off and retry" — quanto mais espera, mais chance de sucesso
- 1s é cedo demais, 503 ainda está acontecendo
- 2s/5s/12s dá margem real pro lado deles se recuperar
```

