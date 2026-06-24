# Fix: hero principal não aparece no iPhone 16

## Causa
`src/assets/hero-illustration.png` está salvo em modo **palette (P) PNG** com transparência. O Safari do iOS 18 (iPhone 16) tem um bug conhecido de decodificação de PNGs paletados com canal alfa — a tag `<img>` carrega mas não pinta. Como atrás do `<img>` existe um div com gradiente roxo (`from-primary/40 to-accent/30 blur-3xl`), o usuário vê apenas o quadrado roxo. No iPhone 13 Pro (iOS mais antigo) a decodificação funciona, por isso aparece normal.

## Solução
Reconverter a imagem para PNG **RGBA** (32-bit, sem paleta), que o iOS 18 decodifica corretamente. Mantém qualidade visual idêntica, tamanho similar (~230 KB → ~280 KB), sem mudar nada na UI.

## Passos
1. Reabrir `src/assets/hero-illustration.png` em Python/PIL, converter para `RGBA` e salvar por cima com `optimize=True`.
2. Reupload via `lovable-assets create` (substitui o asset com o mesmo nome de import) — ou simplesmente sobrescrever o arquivo local, já que ele é importado direto via `import heroIllustration from "@/assets/hero-illustration.png"` e o Vite faz o bundling.
3. Validar abrindo a landing — o halo roxo continua aparecendo *atrás* do mockup, e a ilustração aparece por cima em qualquer iOS.

## Detalhes técnicos
- Modo atual confirmado: `(1024, 1024) P PNG` (palette + tRNS).
- Modo alvo: `RGBA` ou JPEG opaco sobre fundo neutro (não recomendado aqui porque o hero tem transparência ao redor para o halo aparecer).
- Nenhum código JSX/CSS muda. Só reescrita do arquivo binário.

## Fora do escopo
- Não vou trocar o componente, o halo, o `drop-shadow-2xl` nem a animação.
- Não vou converter para WebP — manter PNG evita qualquer regressão de fallback.
