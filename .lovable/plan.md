

# Sincronizar Landing.tsx com o Projeto Original (Aura OS)

## Divergencias Encontradas

Comparei linha a linha o `Landing.tsx` atual com o original do Aura OS. A `FeatureBar.tsx` esta identica. As divergencias no Landing sao:

| Local | Atual (errado) | Original (correto) |
|---|---|---|
| **Hero image** (linha 168) | `className="hidden lg:block"` | `className="flex justify-center lg:block"` — imagem visivel em TODAS as telas |
| **Hero image alt** | `"InfluLab Dashboard"` | `"InfluLab - Estratégia para todos os nichos"` |
| **Hero image sizing** | `className="w-full h-auto drop-shadow-2xl"` | `className="w-full max-w-lg mx-auto drop-shadow-2xl"` |
| **Nav bar** | `bg-background/95` | `bg-white/95` com classes extras nos botoes |
| **Background gradients** | Faltam 2 gradientes extras (bottom-left e bottom-right blurs) |
| **Hero grid gap** | `gap-12` | `gap-12 lg:gap-8` |
| **Motion blur** | Falta `filter: "blur(6px)"` nos initials do hero | Tem blur nos dois lados |
| **Text wrap** | Falta `style={{ textWrap: "balance" }}` e `"pretty"` em varios headings |
| **CTA text** | `"Sem cartão de crédito"` | `"Sem cartão de crédito • Cancele quando quiser"` |
| **Pain points desc** | Textos truncados (mais curtos) | Textos completos |
| **Solution desc** | Truncada | Inclui "do hook ao CTA" |
| **Social proof** | Sem subtitulo e quotes truncadas | Subtitulo + quotes completas |
| **Hover states** | Faltam `hover:bg-white/8`, `hover:shadow-md`, `active:scale-[0.97]` em varios cards/botoes |
| **Final CTA heading** | Truncado | Inclui "Você vai continuar postando no escuro?" |
| **Footer logo** | `h-7` | `h-5` |
| **Imports** | Faltam `BarChart3, Brain, Layers` | Importados (mesmo que nao usados diretamente) |

## Plano

### Passo unico: Substituir Landing.tsx pelo codigo completo do Aura OS

Em vez de corrigir cada divergencia individualmente, vou sobrescrever o `Landing.tsx` inteiro com a versao exata do Aura OS (592 linhas). Isso garante paridade total e evita que alguma diferenca passe despercebida.

A `FeatureBar.tsx` e a `HeroMockup.tsx` nao precisam de alteracao — o HeroMockup nao e mais usado (foi substituido pela imagem real) e o FeatureBar esta identico.

## Detalhes Tecnicos
- Arquivo unico afetado: `src/pages/Landing.tsx`
- Sem mudanca de dependencias — todos os imports ja existem no projeto
- Os assets (`heroIllustration`, `logoHorizontal`) ja estao em `src/assets/`

