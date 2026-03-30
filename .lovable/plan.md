

# Corrigir Flash de Estrategias Fallback + Tornar Visao Semanal Funcional

## Problema 1: Flash da matriz fallback

O hook `useUserStrategies` inicializa com as estrategias padrao (fallback) e so substitui apos carregar do banco. Porem, `Index` e `Matrix` nao verificam o estado `loading` antes de renderizar — entao o usuario ve brevemente "O Despertar", "Ritual da Beleza" etc antes dos dados personalizados aparecerem.

### Correcao

**Arquivos:** `src/pages/Index.tsx` e `src/pages/Matrix.tsx`

- Extrair `loading` de `useUserStrategies()`
- Enquanto `loading === true`, exibir skeleton/spinner em vez do conteudo
- Isso elimina o flash de dados incorretos

**Arquivo:** `src/hooks/useUserStrategies.ts`

- Inicializar `strategies` como array vazio (`[]`) em vez de `fallbackStrategies`
- Somente usar fallback se o usuario nao tiver sessao ou nao tiver dados personalizados
- Isso garante que nenhum dado fallback apareca para usuarios logados antes do fetch completar

## Problema 2: Visao Semanal nao funcional

O componente `WeeklyView` e puramente visual — nao tem interacao.

### Correcao

**Arquivo:** `src/components/WeeklyView.tsx`

- Adicionar `onClick` em cada dia para navegar ate a pagina de script ou abrir detalhe do dia
- Usar `react-router-dom` `useNavigate` para redirecionar ao clicar (ex: `/script` se for o dia atual, ou abrir `DayDetailCard` para outros dias)
- Feedback visual de cursor pointer e hover

## Arquivos alterados

1. `src/hooks/useUserStrategies.ts` — inicializar vazio, usar fallback apenas como ultimo recurso
2. `src/pages/Index.tsx` — verificar `loading`, mostrar skeleton
3. `src/pages/Matrix.tsx` — verificar `loading`, mostrar skeleton
4. `src/components/WeeklyView.tsx` — adicionar navegacao ao clicar nos dias

