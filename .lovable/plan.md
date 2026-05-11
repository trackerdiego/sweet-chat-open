## Objetivo

Transformar a Landing atual em uma página de alta conversão adicionando os elementos que faltam: **provas sociais em vídeo (Wistia/YouTube)**, depoimentos escritos mais ricos, demonstração visual do produto, indicadores de confiança e gatilhos de urgência — sem destruir a estética atual (charcoal + roxo + serif + glassmorphism) que já funciona.

## Diagnóstico do que falta hoje

Revisei `src/pages/Landing.tsx`. Estrutura atual: Nav → Hero → FeatureBar → Pain Points → Solution → Features Grid → Social Proof (3 depoimentos só texto) → Pricing → FAQ → Final CTA.

**Lacunas críticas pra conversão:**
1. Zero vídeo (depoimentos, demo do produto, founder pitch)
2. Depoimentos só texto, sem foto, sem @, sem métrica concreta ("triplicou" — quanto era? virou quanto?)
3. Não tem "logos/números agregados" (X usuários, Y scripts gerados, Z nichos)
4. Não tem demo visual do produto em ação (screenshots de matriz/script reais)
5. Não tem comparação ("InfluLab vs ChatGPT vs fazer sozinho")
6. Garantia/risco-zero não destacado (só na FAQ)
7. Não tem âncora de autoridade (quem está por trás, metodologia)
8. Final CTA sem reforço de prova social

## Nova estrutura proposta

```text
1.  Nav (manter)
2.  Hero (manter + adicionar: rating ⭐⭐⭐⭐⭐ + "+X criadores" + avatares empilhados abaixo do CTA)
3.  Logos/Stats Bar — barra horizontal: "+1.200 criadores", "+15.000 scripts", "23 nichos", "4.9/5 ⭐" (NOVA)
4.  FeatureBar (manter)
5.  Pain Points (manter)
6.  Solution Transition (manter)
7.  Vídeo Demo do Produto — 1 vídeo grande do produto em ação (Wistia/YouTube embed) (NOVA)
8.  Features Grid (manter)
9.  Como Funciona em 3 Passos — visual numerado: 1) Onboarding 2) IA gera matriz 3) Você posta (NOVA)
10. Provas Sociais em Vídeo — grid de 3-4 vídeos verticais (depoimentos reais Wistia/YouTube) (NOVA — coração do pedido)
11. Depoimentos Escritos Ricos — cards com foto real, @handle, antes/depois numérico, plataforma (UPGRADE)
12. InfluLab vs Alternativas — tabela comparativa (vs ChatGPT, vs agência, vs fazer sozinho) (NOVA)
13. Pricing (manter + adicionar selo "Garantia 7 dias" + reforço de prova social no card)
14. Garantia — bloco dedicado "Risco zero: 7 dias ou seu dinheiro de volta" (NOVA)
15. FAQ (manter)
16. Final CTA (manter + adicionar mini prova social acima do botão)
17. Footer (manter)
```

## Detalhes de implementação por seção nova

### 3. Logos/Stats Bar
- Barra fina logo abaixo do hero, fundo `bg-white/5` sobre charcoal
- 4 colunas em desktop, 2x2 em mobile
- Números grandes em serif + label pequeno em uppercase tracking
- Edita propriedade num único array `stats` no topo do arquivo pra facilitar update

### 7. Vídeo Demo do Produto
- Componente novo `<VideoEmbed />` reutilizável que aceita `provider="wistia" | "youtube"` + `id`
- Aspect ratio 16:9, max-width ~900px, sombra forte com glow roxo, bordas arredondadas
- Lazy load (só carrega o iframe ao chegar no viewport — economiza performance)
- Placeholder com thumbnail + play button enquanto não carrega
- Por enquanto colocamos placeholders com IDs genéricos pra você trocar pelos reais

### 10. Provas Sociais em Vídeo (núcleo do pedido)
- Grid responsivo: **3 vídeos verticais 9:16** em desktop (lado a lado), **carrossel horizontal** em mobile (swipe)
- Cada card: vídeo (Wistia ou YouTube Shorts) + nome + @ + nicho + métrica destaque ("De 800 → 12k seguidores em 60 dias")
- Componente `<VideoTestimonialCard />` aceita `videoProvider`, `videoId`, `name`, `handle`, `niche`, `metric`, `quote`
- Mesma técnica de lazy load do item 7
- Array `videoTestimonials` no topo do arquivo — você troca os IDs depois sem mexer em JSX

### 11. Depoimentos Escritos (upgrade dos atuais)
- Mantém os 3 atuais mas adiciona: avatar real (foto ou inicial estilizada), @handle, plataforma (Instagram/TikTok), métrica antes/depois ("47 → 1.2k likes/post")
- Pode subir pra 6 cards em grid 3x2

### 12. InfluLab vs Alternativas
- Tabela responsiva (em mobile vira cards empilhados)
- Colunas: Recurso | InfluLab ✅ | ChatGPT ⚠️ | Fazer sozinho ❌
- 6-7 linhas: Estratégia personalizada por nicho, Scripts prontos pra usar, Análise visceral da audiência, Guia diário automático, Custo mensal, Tempo de setup, Suporte humano

### 14. Garantia
- Card largo, fundo gradiente roxo sutil, ícone de escudo
- Texto: "Teste por 7 dias. Se não amar, devolvemos 100% — sem perguntas."
- Aumenta conversão e diminui ansiedade pré-checkout

## Decisões técnicas

- **Sem nova lib de vídeo**: Wistia oferece embed via `<script>` + `<div class="wistia_embed">`. YouTube via `<iframe>`. Ambos com `loading="lazy"` nativo. Se mais tarde precisarmos de player customizado, aí avaliamos `react-player`.
- **Componentes novos** ficam em `src/components/landing/`: `VideoEmbed.tsx`, `VideoTestimonialCard.tsx`, `StatsBar.tsx`, `HowItWorks.tsx`, `ComparisonTable.tsx`, `GuaranteeBlock.tsx`. Mantém `Landing.tsx` legível.
- **Design system**: zero cores hardcoded — só tokens (`primary`, `charcoal`, `accent`, `white/X`). Mantém serif no h2/h3.
- **Mobile-first**: tudo testado em 375px primeiro. Carrossel de vídeo usa scroll-snap nativo (sem lib).
- **Performance**: vídeos com `IntersectionObserver` (já temos `useInView` do framer-motion, dá pra reaproveitar) — só monta o iframe quando entra na tela. Crucial pq embed de vídeo é pesado.
- **SEO**: adicionar JSON-LD de `VideoObject` pra cada vídeo de depoimento (Google indexa e mostra thumb na busca).

## O que NÃO vou tocar

- Hero principal (copy + ilustração + CTA) — só adiciona prova social abaixo do CTA
- Pricing card (estrutura) — só adiciona selo de garantia
- FAQ
- Footer
- Backend, edge functions, banco — 100% frontend

## Conteúdo que vou precisar de você (depois do plano aprovado)

Pra ficar 100% real (não placeholder):
1. **IDs dos vídeos** (Wistia hashed_id ou YouTube video ID) — dos 3-4 depoimentos + 1 demo do produto
2. **Métricas reais** dos depoimentos (antes → depois)
3. **Stats agregados** (quantos usuários/scripts/nichos)
4. **Foto e @** dos depoentes (ou seguimos com avatar inicial estilizado)

Enquanto você não envia, deixo placeholders bem marcados (`// TODO: trocar`) e a página já fica funcional pra revisão visual.

## Bloco copia-e-cola pra VPS

```bash
# nada a rodar — Vercel auto-deploya do GitHub (mudanças 100% frontend)
```

## Confirmar antes de implementar

1. **Provedor preferido pros depoimentos**: Wistia (melhor analytics/conversão), YouTube (grátis, mais fácil) ou misto?
2. **Quantos vídeos de depoimento**: 3 (mais limpo, foco) ou 4 (mais social proof)?
3. **Mantém todas as seções novas** propostas (stats bar, demo, how it works, comparação, garantia) ou prefere que eu corte alguma pra página não ficar muito longa?
