# Plano: Tutoriais em vídeo (Onboarding, Matriz, Scripts, Tools, Tarefas)

## Visão geral
Híbrido: `/ajuda` vira a central de tutoriais (1 vídeo por funcionalidade) e cada página do app ganha um botão "?" no header que leva direto pro vídeo correspondente via âncora (`/ajuda#matriz`). Hospedagem em **Wistia** (player limpo, sem ads, branding controlável — já suportado pelo `VideoEmbed` existente).

## O que muda na UI

### 1. `/ajuda` — nova seção "Tutoriais"
Substituir o item "Em breve" do accordion atual por uma seção real com 5 cards de vídeo, cada um com `id` âncora pra link direto:

- `#onboarding` — Como configurar seu perfil
- `#matriz` — Entendendo sua matriz estratégica de 30 dias
- `#scripts` — Gerando roteiros com IA
- `#tools` — Ferramentas (hooks, CTAs, storytelling…)
- `#tarefas` — Checklist diária e como ganhar coins

Cada card: thumbnail Wistia + play, título, descrição curta, duração. Lazy-load (padrão já existente no `VideoEmbed`).

### 2. Botão "?" em cada página
Adicionar nos headers de:
- `Onboarding.tsx`
- `Matrix.tsx`
- `Script.tsx`
- `Tools.tsx`
- `Tasks.tsx`

Comportamento: ícone `HelpCircle` discreto → `navigate('/ajuda#matriz')`. Em `/ajuda`, detectar `location.hash` no mount, abrir o accordion certo e fazer `scrollIntoView` suave.

### 3. Componente reutilizável
`src/components/HelpButton.tsx` recebendo `topic: 'onboarding' | 'matriz' | 'scripts' | 'tools' | 'tarefas'` — encapsula ícone + navegação, mantém visual consistente.

## Implementação técnica

**Arquivos novos:**
- `src/components/HelpButton.tsx` — botão "?" reutilizável
- `src/data/tutorials.ts` — mapa `{ topic, wistiaId, title, description, duration }` (fonte única de verdade; trocar IDs quando vídeos estiverem prontos)

**Arquivos editados:**
- `src/pages/Help.tsx` — substituir bloco "Tutoriais em breve" por accordion com 5 itens, cada um com `<VideoEmbed provider="wistia" videoId={...} />`. Adicionar lógica de hash → abrir item + scroll suave.
- `src/pages/Onboarding.tsx`, `Matrix.tsx`, `Script.tsx`, `Tools.tsx`, `Tasks.tsx` — adicionar `<HelpButton topic="..." />` nos headers.

**Não precisa mexer em `VideoEmbed`** — já suporta Wistia nativamente (`https://fast.wistia.net/embed/iframe/${videoId}`). Único detalhe: `thumbnailUrl` precisa ser passado manualmente pra Wistia (YouTube infere automático). Vou aceitar `thumbnailUrl` opcional em cada entrada de `tutorials.ts`; quando não tiver, cai no gradient fallback que já existe no componente.

**Sem backend:** zero mudança de schema, zero edge function, zero deploy de VPS. É 100% frontend → auto-deploy Vercel ao commitar.

## Estado dos vídeos
Você ainda não gravou. Estratégia em 2 fases:

**Fase 1 (agora):** Subo a estrutura toda funcionando com **placeholders** — botão "?" navegando, accordion abrindo na âncora certa, cards mostrando "Vídeo em produção" no lugar do player. Tudo pronto pra receber os IDs.

**Fase 2 (depois que você gravar):** Você sobe os 5 vídeos no Wistia, me manda os 5 IDs (formato: `abc123xyz`) e eu faço 1 PR de 1 minuto trocando os valores em `src/data/tutorials.ts`.

Posso também sugerir o roteiro de cada vídeo (script falado + sequência de cliques na tela) se quiser — ajuda a manter consistência e duração curta (90-180s cada é o ideal pra retenção).

## O que NÃO faz parte
- Não mexe em `/`, landing, ou paywall
- Não adiciona ferramenta de gravação/upload no app
- Não cria sistema de "marcar como assistido" (pode entrar num v2 se quiser gamificar com coins)

## Próximos passos (após este plano)
1. Implementar Fase 1 com placeholders
2. Você grava + sobe os 5 vídeos no Wistia
3. Me manda os IDs → troca rápida em `tutorials.ts`
