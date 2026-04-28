# Encerrar trial público + atualizar pricing

## Decisões confirmadas
- **Mensal**: R$47/mês (sem mudança)
- **Anual**: **R$297/ano** (era R$397) → equivale a **R$24,75/mês** (~47% de desconto vs mensal)
- **Trial atual**: usuários que já estão em trial mantêm até a data original. Apenas novos signups não recebem mais trial na comunicação.
- **Destaque**: card único focado no anual, com link/toggle discreto pro mensal.

## O que muda

### 1. Landing (`src/pages/Landing.tsx`)
- **Nav (linha 188-194)**: botão "Começar grátis" → **"Assinar agora"**
- **Hero (linha 238-250)**: 
  - CTA "Começar grátis — 7 dias" → **"Assinar agora"**
  - Linha "Sem cartão de crédito • Cancele quando quiser" → **"Cancele quando quiser • Suporte humano"**
- **Card de pricing (linha 450-499)**: redesenho focado no anual
  - Título do plano, badge "Acesso completo" mantidos
  - Preço grande: **R$ 24,75 /mês** (com nota "no plano anual de R$297 — economize 47%")
  - Linha discreta abaixo: "ou R$47/mês no plano mensal" como link/toggle pequeno
  - Selo extra: **"Mais escolhido • Economia de R$267/ano"**
  - CTA "Testar 7 dias grátis" → **"Assinar plano anual"**
  - Subtexto "Comece grátis, assine quando quiser" → **"Acesso imediato • Cancele a qualquer momento"**
- **Final CTA (linha 543-550)**: "Começar meu teste grátis" → **"Assinar agora"**
- **FAQ**: revisar pergunta "Posso cancelar quando quiser?" pra remover qualquer menção a trial; adicionar/ajustar pergunta sobre garantia (se houver) ou diferença anual vs mensal.

### 2. Checkout Modal (`src/components/CheckoutModal.tsx`)
- Atualizar `plans` (linha 44-47):
  - `yearly`: `price: 297, perMonth: 24.75, description: "R$297/ano (≈ R$24,75/mês)"`
  - `monthly`: sem mudança
- Default `selectedPlan` permanece `"yearly"` (já está)
- Adicionar destaque visual no card do plano anual: badge "Economize 47%" + risco no preço mensal-equivalente
- CTA do botão final: "Confirmar e pagar"

### 3. TrialBanner (`src/components/TrialBanner.tsx`)
- **Mantém igual** — só aparece pra quem ainda está em trial (decisão: deixa correr até o fim). Apenas confirmar que o copy "X dias grátis restantes" segue válido pra esses usuários legados.

### 4. AccessGuard (`src/components/AccessGuard.tsx`)
- Headline "Seu trial gratuito acabou" mantém (faz sentido pros legados).
- Para `isExpired === false && !hasAccess` (novos usuários sem trial), headline já cai no fallback "Acesso bloqueado". Ajustar subtexto pra: **"Escolha um plano abaixo pra desbloquear o app. Em segundos você está dentro."**

### 5. Backend Asaas (`supabase/functions/create-asaas-subscription/index.ts`)
- Linha 88: trocar `397.0` por **`297.0`** no plano yearly. Sem outras mudanças (cycle YEARLY mantido).
- Deploy via `./scripts/deploy-selfhost.sh create-asaas-subscription`.

### 6. Index (`src/pages/Index.tsx`, linha 112)
- Texto "X dias grátis restantes" no header só aparece pro `freeLimits` antigo — verificar se esse path ainda é usado; se sim, manter. Sem mudança obrigatória.

## O que NÃO muda
- Lógica do `subscription_state.status='trial'` no backend (legados continuam ativos).
- Default de `nextDueDate` (cobrança no dia seguinte). Sem trial novo, isso passa a ser "cobrança imediata", que é o comportamento esperado.
- Webhook, cron de descontos, fluxo de coins → tudo intocado.
- Templates de email, SMTP, edge functions de IA → intocados.

## Entrega final
Resposta termina com bloco copia-e-cola pra VPS:
- `cd /root/app && git pull && ./scripts/deploy-selfhost.sh create-asaas-subscription`
- Frontend: deploy automático Vercel ao subir pra `main`.
- Sem migration SQL necessária.

## Pontos de atenção (não-bloqueantes, mas vale revisar depois)
- **Comunicação aos legados em trial**: se quiser, podemos disparar um aviso in-app pra quem ainda está em trial dizendo "trial gratuito não está mais disponível pra novos usuários, aproveite seus X dias restantes" — não vou implementar agora, só sinalizo.
- **Garantia**: hoje não há garantia de devolução. Se quiser oferecer "7 dias de garantia" pra suavizar a remoção do trial, posso adicionar copy + lógica num próximo passo.