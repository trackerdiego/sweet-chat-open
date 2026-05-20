## Objetivo

Substituir a animação atual do `RealtimeTracker` por uma versão cíclica e coerente — como na referência ZK Delivery — onde a animação caminha sozinha do primeiro ao último círculo, com pulsos, check verdes nos passos concluídos e traços que preenchem progressivamente. Tudo cabendo na largura sem rolagem horizontal, inclusive no mobile.

## Comportamento de animação

Estado interno `activeIndex` controlado por `setInterval` (ex.: a cada 1.6s avança 1; ao chegar no último, espera ~2s e reinicia em 0).

Para cada passo, três estados visuais:

- **Passado** (`i < activeIndex`): círculo com `ring` colorido sólido, ícone na cor do passo, badge verde de check (CheckCircle2) no canto superior direito, label em branco/70.
- **Ativo** (`i === activeIndex`): círculo com `ring` duplo + halo pulsante (`animate-pulse-neon`), ícone vibrante, label em branco e em negrito, leve `scale-110`.
- **Futuro** (`i > activeIndex`): círculo opaco (opacity 50), sem check, label em branco/40.

Traços entre passos viram uma barra `bg-white/10` com um preenchimento `bg-gradient-to-r from-primary to-accent` cuja largura é animada via Framer Motion:
- 0% se `i >= activeIndex`
- 100% se `i < activeIndex`
- Para o traço imediatamente após o ativo (`i === activeIndex`), animar de 0→100% durante o tempo que o passo fica ativo (preenchimento progressivo, como na referência).

Texto inferior "Status atual: <label do ativo>" troca conforme `activeIndex` muda, com `AnimatePresence` (fade curto).

## Sem scroll horizontal

Trocar o layout de `flex overflow-x-auto` por **CSS Grid** com `grid-template-columns: repeat(6, minmax(0,1fr))` para os círculos + labels, e os traços renderizados em uma camada absoluta atrás ou via grid intercalado.

Esquema:

```text
[ico] -- [ico] -- [ico] -- [ico] -- [ico] -- [ico]
 lbl     lbl     lbl     lbl     lbl     lbl
```

Implementação prática: grid de 11 colunas (6 ícones + 5 traços), `gap` pequeno, traços com `flex-1` ou `w-full` dentro da própria coluna. Mobile encolhe ícones para `w-11 h-11`, labels com `text-[10px] leading-tight` e `break-words` para "Aguardando confirmação" tipo "Análise Visceral" caberem em 2 linhas.

Em telas <380px, reduzir gap e ícones mais ainda; nenhum `overflow-x-auto`.

## Arquivos afetados

- `src/components/landing/RealtimeTracker.tsx` — reescrita completa:
  - `useState` + `useEffect` com `setInterval` para `activeIndex`
  - Grid responsivo (sem scroll)
  - Badge `CheckCircle2` nos passados
  - Framer Motion nos traços (largura animada) e no label "Status atual"
- `src/index.css` — opcional: ajustar `@keyframes pulse-neon` se o brilho atual estiver discreto demais (deixar pulso mais visível com 2 anéis: um inner ring + outer glow soft).
- Nenhuma mudança em outras seções da Landing.

## Pontos técnicos

- Cleanup do `setInterval` no unmount.
- Respeitar `prefers-reduced-motion`: se ativo, congelar em `activeIndex = 2` sem ciclar.
- Manter a paleta atual de cores por passo (amber, fuchsia, violet, sky, emerald, pink).
- Sem novas dependências (framer-motion e lucide-react já estão no projeto).

## Validação pós-implementação

- Visual em 1147px (viewport atual), 768px e 375px — confirmar que nenhum scroll horizontal aparece.
- Confirmar que o ciclo reinicia suavemente.
- Confirmar contraste do label ativo vs futuro.
