# Substituir iniciais por fotos reais nos avatares do hero

## Mudança
No hero da Landing (`src/pages/Landing.tsx`, linhas 268-287), o bloco "+1.200 criadores ativos" mostra 5 círculos com as letras C/J/F/M/R sobre gradiente roxo. Trocar pelas 5 fotos enviadas.

## Passos

1. **Copiar as 5 imagens** para `src/assets/avatars/`:
   - `imgi_7_Frame-3.png` → `avatar-1.png`
   - `imgi_6_Frame-4.png` → `avatar-2.png`
   - `imgi_5_Frame-5.png` → `avatar-3.png`
   - `imgi_4_Frame-8.png` → `avatar-4.png`
   - `imgi_3_Frame-9.png` → `avatar-5.png`

2. **Editar `src/pages/Landing.tsx`**:
   - Importar as 5 imagens como módulos ES6
   - Substituir o `.map(["C","J",...])` por um array de `{ src, alt }` renderizando `<img>` com mesmas classes (`w-8 h-8 rounded-full ring-2 ring-charcoal`) + `object-cover` e `loading="lazy"`
   - Remover o gradiente de fundo (não aparece mais por baixo da foto)

## Fora de escopo
- Mexer em qualquer outro avatar/seção da landing
- Backend, qualquer outra página

100% frontend, deploy automático Vercel.
