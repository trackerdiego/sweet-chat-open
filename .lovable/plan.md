## Remover seção de depoimentos em vídeo vertical da landing page

### Contexto
A landing page atual exibe duas seções de vídeo:
1. **Vídeo horizontal de demo** (`ProductDemoVideo`) — demonstração do produto em 16:9.
2. **Depoimentos em vídeo vertical** (`VideoTestimonialsGrid`) — grid de cards com vídeos de criadores em formato vertical (scroll horizontal no mobile).

### O que será feito
Remover a seção `VideoTestimonialsGrid` da `Landing.tsx`, mantendo apenas o `ProductDemoVideo` (horizontal). Também remover a importação do componente caso não seja mais usada em outro lugar do arquivo.

### Arquivos alterados
- `src/pages/Landing.tsx`
  - Remover importação de `VideoTestimonialsGrid`
  - Remover uso `<VideoTestimonialsGrid />` da JSX

### Técnico
100% frontend. Deploy automático via Vercel. Sem impacto no backend ou Supabase.