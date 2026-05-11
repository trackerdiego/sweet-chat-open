# Clarear os 2 planos na landing

## Problema
Hoje a landing mostra **só 1 card** com "R$24,75/mês" gigante. Isso confunde:
- Não fica claro que existe um plano Mensal real (R$47/mês)
- O R$24,75 parece um plano cobrável, mas é só a equivalência do anual à vista (R$297 ÷ 12)
- Tabela comparativa também só mostra "R$24,75" como custo mensal

## Mudanças

### 1. `src/pages/Landing.tsx` — Seção de Pricing (linhas ~503-565)
Substituir o card único por **2 cards lado a lado** (stack no mobile, grid 2 colunas em md+):

**Card A — Mensal (sutil)**
- Título: "Mensal"
- Preço: **R$47** /mês
- Subtítulo: "Cobrado todo mês • cancele quando quiser"
- Lista de benefícios igual ao anual
- CTA secundário (outline): "Assinar mensal" → `/auth?plan=monthly`

**Card B — Anual (destaque, badge "Mais escolhido")**
- Título: "Anual"
- Preço: **R$297** /ano
- Linha de apoio: "Equivale a R$24,75/mês • economize R$267 (47%)"
- Mesma lista de benefícios
- CTA primário (sólido roxo): "Assinar plano anual" → `/auth?plan=yearly`
- Mantém borda/glow primary, badge gradiente "Mais escolhido"

Hierarquia visual: anual com mais destaque (shadow primary, badge no topo), mensal mais discreto (borda branca/10, sem glow), mas ambos legíveis e clicáveis.

### 2. `src/components/landing/ComparisonTable.tsx` (linha 11)
Trocar:
```
"Custo mensal": "R$24,75"
```
Por:
```
"Custo mensal": "R$47/mês ou R$24,75 no anual"
```

### 3. `src/pages/Landing.tsx` — FAQ (linha 164)
Já está correto ("O plano mensal custa R$47/mês. O anual custa R$297…"). **Sem mudança.**

### 4. `src/components/CheckoutModal.tsx`
**Sem mudança** — já tem ambos os planos corretos com `monthly: 47` e `yearly: 297`.

## Detalhes técnicos
- 100% frontend, sem backend, sem migration
- Tokens semânticos (primary, accent, white/X) — sem cores hardcoded
- Mobile-first: `grid-cols-1 md:grid-cols-2 gap-4`, container expande de `max-w-md` → `max-w-3xl`
- Reusa o array `benefits` que já existe no arquivo
- Deploy automático via Vercel (frontend)

## Fora de escopo
- Mexer em fluxo de checkout, Asaas, ou subscription_state
- Mudar preços reais (continua R$47 e R$297)
- Tocar em /auth, AccessGuard ou qualquer lógica de paywall
