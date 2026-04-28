## Objetivo

Fazer os botões **"Assinar agora"** da landing rolarem até a seção de planos (em vez de ir direto pro `/auth`), e adicionar uma opção **mensal discreta** dentro do card de planos atual — mantendo o anual em destaque.

## Mudanças em `src/pages/Landing.tsx`

### 1. Adicionar `id="planos"` na seção de pricing
Linha 456 — adicionar âncora na `<Section>` do pricing pra permitir scroll programático.

### 2. Criar handler de scroll
Função simples no topo do componente:
```ts
const scrollToPlanos = () => {
  document.getElementById("planos")?.scrollIntoView({ behavior: "smooth", block: "start" });
};
```

### 3. Trocar `onClick` dos 3 botões "Assinar agora" pra rolar até planos
- **Nav** (linha 195): `onClick={scrollToPlanos}`
- **Hero** (linha 246): `onClick={scrollToPlanos}`
- **CTA Final** (linha 563): `onClick={scrollToPlanos}`

O botão **dentro do card de planos** ("Assinar plano anual", linha 506) continua indo pra `/auth` — esse é o ponto de conversão real.

### 4. Adicionar opção "Mensal" discreta no card de planos
Após o botão principal "Assinar plano anual" (linha 511), inserir um divisor sutil + link discreto pro mensal:

```
─── ou ───
Prefere mensal? Assine por R$47/mês  →
```

Ambos os links/botões levam pra `/auth`. O `CheckoutModal` já tem toggle Mensal/Anual interno, então não precisa passar parâmetro — o usuário escolhe no checkout. (Opcional: passar `?plan=monthly` via query string e ler no `CheckoutModal` pra pré-selecionar mensal — confirmo se você quiser esse refinamento.)

Visual proposto pra parte discreta:
- Texto pequeno (`text-xs` ou `text-sm`), cor `text-white/50`
- Botão `variant="ghost"` ou `variant="link"` em vez de primary
- Centralizado, sem destaque competindo com o anual

## Comportamento final

| Botão | Antes | Depois |
|---|---|---|
| Nav "Assinar agora" | → `/auth` | → rola até planos |
| Hero "Assinar agora" | → `/auth` | → rola até planos |
| CTA final "Assinar agora" | → `/auth` | → rola até planos |
| Card "Assinar plano anual" | → `/auth` | → `/auth` (igual) |
| **NOVO** "Prefere mensal? R$47/mês" | — | → `/auth` |

## Fora de escopo
- Mudanças no `CheckoutModal` (já tem ambos os planos).
- Edge functions / backend (preço anual já está R$297).
- Não toca em `mem://` — já está alinhado.

## Deploy
Mudança puramente frontend → push pro GitHub → Vercel auto-deploya. Sem ação na VPS.