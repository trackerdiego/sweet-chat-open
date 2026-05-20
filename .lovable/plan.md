## Objetivo

Deixar a seção "Funciona para qualquer nicho" (marquee) visualmente mais próxima da referência ZK Delivery: **cards maiores com imagem em destaque** (não emoji, não ícone minúsculo), no estilo dos cards de comida da referência.

## Estado atual

`src/components/landing/NichesMarquee.tsx` já usa `NicheIcon` (PNGs reais de `src/assets/niches/*.png`), porém:
- Tamanho `size={18}` → minúsculo, parece ícone de chip
- Layout é "pill" horizontal (`px-4 py-2 rounded-full`) com ícone + texto lado a lado
- Resultado fica longe do visual da referência, onde cada item é um **card grande tipo "foto + legenda"**

## Mudança proposta

Refatorar `NichesMarquee.tsx` para renderizar cada nicho como um **card grande tipo "polaroid"**, igual à referência:

- Card: `w-44 h-44 sm:w-52 sm:h-52` (quadrado), `rounded-2xl`, `neon-card` (mantém glassmorphism roxo)
- Imagem do nicho (`NicheIcon`) ocupando a área toda: `size={140}` em mobile, `size={180}` em desktop, com `object-contain` e leve `drop-shadow`
- Label sobreposto no canto inferior esquerdo: chip preto translúcido (`bg-black/50 backdrop-blur`) com texto branco bold (`text-sm font-bold`), no estilo da referência ("Sushi", "Pizza", "Hambúrguer"…)
- Borda sutil roxa no hover/ativo (mantém DNA neon do nosso tema, não copia o laranja do ZK)
- Gap entre cards aumenta para `gap-4 sm:gap-5`
- Duas linhas continuam: uma rola para esquerda, outra para direita (mantém `animate-marquee-x` / `animate-marquee-x-reverse`)
- Velocidade ajustada: como os cards são maiores, aumentar duração da animação para 50s para não passar voando

## Pontos técnicos

- `NicheIcon` já aceita `size` numérico e renderiza `<img>` com `object-contain` → só passar tamanho maior
- Nenhuma alteração em `tailwind.config.ts` (keyframes `marquee-x` continuam servindo; só ajusto duração via classe utilitária inline `[animation-duration:50s]` ou trocando a animation)
- Mascaramento lateral (`marquee-mask`) mantido
- Sem mudança em outros componentes

## Arquivo afetado

- `src/components/landing/NichesMarquee.tsx` — reescrita do componente `Row` (item visual) e ajuste de espaçamento

## Validação pós-implementação

- Em 769px (viewport atual) e 375px: cards aparecem em tamanho generoso, com imagem nítida e label legível
- Sem scroll horizontal da página (marquee corre dentro do próprio container com `overflow-hidden`)
- Animação contínua suave nas duas direções
