## Objetivo

Impedir que qualquer usuário — inclusive a equipe (premium manual sem `asaas_customer_id`) — dispare a geração do Hype do dia (e queime tokens Gemini) antes de você decidir liberar. Hoje só pagantes pós-8 dias estão gateados; equipe vê o componente direto e dispara `start-hype-job` no mount.

## Estado atual (`src/components/GiftUnlockCard.tsx`)

- `isManualPremium && !previewDate` → renderiza `<HypeOfTheDay />` **sem prazo**. É o vazamento.
- `!firstPaidAt` → GiftCard estático "Seu bônus tá chegando" (ok).
- `firstPaidAt + 8d > now` → GiftCard contador (ok).
- `firstPaidAt + 8d <= now` → `<HypeOfTheDay />` (ok).

## Mudança

### 1. Frontend — `src/components/GiftUnlockCard.tsx`

Trocar o branch `isManualPremium` para mostrar um GiftCard estático com copy "Em breve" em vez de renderizar `<HypeOfTheDay />`. Conteúdo só desbloqueia se uma flag global de release estiver ligada.

- Adicionar constante `HYPE_GLOBAL_RELEASE = false` no topo do arquivo (kill-switch que você liga em uma única linha quando assinar a ferramenta de thumbs).
- Novo branch antes do bloco existente: se `!HYPE_GLOBAL_RELEASE` e for `isManualPremium` (sem `firstPaidAt` real), mostrar GiftCard com:
  - título: "Hype do dia chegando em breve"
  - subtítulo: "Liberando para todos quando a ferramenta de tendências estiver pronta"
  - bigText: "Em preparação"
  - small: "Hype do dia — tendências virais do Brasil"
- Quando `HYPE_GLOBAL_RELEASE = true`, o comportamento volta ao atual (equipe vê direto, pagantes seguem o gate de 8 dias).
- O AdminPreviewPanel (chip flutuante) continua funcionando: você pode ativar uma data simulada de `firstPaidAt` para ver o card de contador, OU virar a flag para `true` localmente para testar o HypeOfTheDay real.

Resultado em prod com flag `false`:

| Cenário | Antes | Depois |
|---|---|---|
| Trial sem pagar | Card "Seu bônus tá chegando" | Igual |
| Pago, < 8d | Contador regressivo | Igual |
| Pago, >= 8d | HypeOfTheDay | **Card "Em breve" (gate global)** |
| Equipe manual | HypeOfTheDay | **Card "Em breve"** |
| Admin com preview ativo | Contador simulado | Igual |

Quando você assinar a ferramenta de thumbs e quiser liberar geral: trocar `HYPE_GLOBAL_RELEASE` para `true`, commit, push, Vercel deploya. Zero mudança de schema, zero mudança de edge function.

### 2. Defesa em profundidade — `src/hooks/useDailyHype.ts`

Garantir que mesmo que alguém renderize `<HypeOfTheDay />` por engano fora do GiftUnlockCard, o disparo automático no mount **não chame Gemini**. Adicionar a mesma flag importada do GiftUnlockCard (ou um módulo compartilhado `src/lib/featureFlags.ts` com `HYPE_GLOBAL_RELEASE`) e no `load()`:
- Se flag desligada: setar `error = 'Em breve'`, `loading = false`, e **não** chamar `start({})`.

Isso previne regressão futura e protege os tokens mesmo se alguém adicionar um segundo ponto de render.

### 3. Sem mudanças

- Edge functions intocadas.
- Sem migration/SQL.
- Sem mexer em `useSubscription` ou no `subscription_state`.
- Cron `fetch-daily-hype` continua populando `daily_hype_raw` (custo zero de Gemini, só ingest de fontes — não dispara IA por usuário).

## Arquivos a editar

- `src/lib/featureFlags.ts` (novo, 1 export)
- `src/components/GiftUnlockCard.tsx` (novo branch isManualPremium + gate global)
- `src/hooks/useDailyHype.ts` (early return se flag desligada)

## Deploy

Só frontend → Vercel auto-deploya do `main` após o git push. Nada na VPS.
