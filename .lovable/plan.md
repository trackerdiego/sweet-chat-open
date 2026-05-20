
## O que consegui extrair da referência (zkdelivery.site)

Fiz scrape completo da página + screenshot + inspeção do HTML. Aqui está o DNA visual dela, destilado:

### Tipografia
- **Inter** (400/500/600/700/800) — UI, headlines e CTAs
- **Roboto** (400/500/700) — corpo de texto secundário
- Headlines **enormes e bold (800)**, sem serifa, com **palavra-chave em gradiente laranja→vermelho** (ex.: "favorita")
- Eyebrow labels: pequenas, uppercase, espaçamento de letra largo, em cima de cada H2

### Paleta (dark-first)
- Background: preto azulado profundo (`#0a0510` → `#1a0a1f`) com **orbs/blurs sutis** flutuando
- Primária: laranja vibrante `#e54d15` → vermelho `#ff3838` (gradiente)
- Accents nos ícones de etapas: amarelo, azul-neon, laranja, roxo, ciano, verde — cada passo do tracker tem cor própria
- Cards: gradiente escuro com **borda fina + glow interno**

### Padrões de layout (o que importa)
1. **Nav flutuante no topo** — pílula central com itens, item ativo preenchido; à direita "Entrar" outline + CTA sólido com seta
2. **Hero split assimétrico**:
   - Esquerda: chip eyebrow (ícone + texto + ícone) → headline gigante 3 linhas com palavra em gradiente → parágrafo curto → segundo parágrafo claro → **dois CTAs lado a lado** (primário sólido com glow / secundário ghost) → link "Entenda como funciona →" → **social proof** (4 avatares empilhados + "+1.000 usuários ativos" + 5 estrelas + "4.9/5")
   - Direita: **mockup de celular flutuante** com glow neon ao redor + **cards de notificação flutuando fora do telefone** (pedido confirmado, saiu para entrega)
   - Background: imagens de produto (pizza/sushi/açaí) borradas e espalhadas como decoração
3. **"Como Funciona" — 3 passos numerados** em cards horizontais com número grande em gradiente
4. **Tracker em tempo real** — pipeline horizontal com 6 ícones coloridos, barras de conexão, **estado ativo com pulse + duplo anel de glow neon** (essa é a animação que você destacou)
5. **Showcase do app** — mockup grande + 3-4 features ao redor com ícone+título+descrição curta
6. **Marquee de categorias** — pílulas rolando infinitamente em duas linhas (direções opostas)
7. **Comparativo "Nós vs Concorrência"** — duas colunas grandes, com cor "ruim" (laranja apagado) vs cor "boa" (verde/primária)
8. **Bloco de pricing** em duas colunas (cliente/parceiro)
9. **Footer CTA** com headline + botão grande

### Efeitos
- Smooth scroll (Lenis)
- **Pulse neon** em estados ativos (boxShadow animado)
- **Gradient text** em palavras-chave de headlines
- Blurred orbs no fundo (purple/orange) que se movem suavemente
- Hover lift nos cards

---

## Plano de aplicação no Influlab

Vou portar a **estrutura, hierarquia, ritmo e efeitos** da ZK para a landing do Influlab, **mantendo o conteúdo atual** (Influência digital, Matriz, Análise Visceral, etc.). Não é cópia 1:1 — é o "vocabulário visual" aplicado ao seu produto.

### Fase 0 — Decisão de cor (preciso de você)
A ZK é laranja-neon sobre preto. Seu app hoje é roxo/violeta sobre claro+escuro. Três caminhos:

- **A. Manter roxo do Influlab** — porto só layout/animações/tipografia. Identidade preservada.
- **B. Trocar para laranja-neon estilo ZK** — mudança total de paleta. Mais ousado, mas perde sua marca.
- **C. Híbrido — roxo neon sobre preto profundo** — pega a *energia* da ZK (dark moody + glow + gradiente quente) mas o gradiente vira `violeta→magenta` em vez de `laranja→vermelho`.

(Vou pedir essa escolha via pergunta visual depois do plano aprovado.)

### Fase 1 — Tokens & base
- `src/index.css`: adicionar variantes "neon" dos tokens existentes (`--primary-glow`, `--accent-glow`), gradient da palavra-chave do hero, shadows com glow forte, background orbs
- Confirmar fontes: Inter já está. Avaliar swap do `Playfair Display` por **Inter 800** nos headlines (a ZK não usa serif — headlines bold sans causam o impacto)
- `tailwind.config.ts`: keyframe `pulse-neon` (boxShadow animado, dois anéis), `marquee` (translateX infinito), `float-slow`

### Fase 2 — Landing reestruturada (componente por componente)
Arquivos em `src/pages/Landing.tsx` e `src/components/landing/`:

1. **Nav flutuante** — pílula no topo com `Início / Como Funciona / Recursos / FAQ` + "Entrar" ghost + "Começar Grátis" sólido com glow
2. **Hero (refatorar `HeroMockup.tsx`)** — split assimétrico com:
   - Chip eyebrow ("✨ Sua estratégia digital com IA ⭐")
   - H1 800 com "**influência**" (ou "matriz", "estratégia") em gradient
   - Dois CTAs lado a lado
   - Social proof: avatares + contagem + rating
   - À direita: mockup de iPhone com a tela do app + cards flutuantes ("Tarefa concluída", "Nova matriz pronta")
   - Background: orbs roxo+rosa borrados + ícones do app espalhados
3. **`FeatureBar.tsx`** → vira **"Como Funciona" em 3 passos numerados** (Onboarding → IA gera matriz → Execute o plano)
4. **Novo: `RealtimeTracker.tsx`** — pipeline horizontal "Dia 1 → 7 → 14 → 21 → 30" com ícones coloridos e **pulse neon no dia atual** (a animação que você quer)
5. **Showcase do app** — mockup grande + 4 features (Análise Visceral, Tarefas Diárias, Scripts, Ferramentas)
6. **Marquee de nichos** — fitness, beleza, moda, etc. rolando em loop
7. **Comparativo** (`ComparisonTable.tsx` existente já cobre isso — só re-skin)
8. **Pricing** — duas colunas (Mensal R$47 / Anual R$297 com destaque)
9. **`GuaranteeBlock.tsx` + CTA final** — manter, reskinar
10. **FAQ + Footer**

### Fase 3 — Microinterações
- Lenis para smooth scroll (`@studio-freight/lenis`)
- Framer Motion: stagger de entrada por seção (já tem em vários cards)
- Pulse neon nas CTAs primárias quando entram em viewport
- Hover lift + glow nos cards de feature

### Fase 4 — QA visual
- Testar mobile (375px) — mockup vira full-width, cards empilham, marquee continua
- Verificar contraste WCAG no modo escolhido
- Confirmar que rotas internas (/onboarding, /matriz etc.) **não foram tocadas** — só landing

---

## O que NÃO vou tocar
- Rotas autenticadas (`/`, `/matriz`, `/tarefas`, etc.)
- Lógica de auth, paywall, edge functions
- Backend / SQL / Asaas
- Conteúdo de copy do app interno

## Arquivos afetados (estimativa)
- `src/index.css` (tokens + keyframes)
- `tailwind.config.ts` (animações)
- `src/pages/Landing.tsx` (orquestração)
- `src/components/landing/*` (refator de 6-8 arquivos + 2 novos: `RealtimeTracker.tsx`, `NichesMarquee.tsx`)
- `index.html` (preload Inter 800; remover Playfair se aprovado)

## Tempo estimado
~2 a 3 turnos de execução, dependendo do tamanho dos refatores e quantos componentes você quer que eu adapte numa rodada.

---

**Depois que você aprovar este plano**, eu pergunto via *visual choice*:
1. Qual direção de cor (A/B/C acima)
2. Se quer manter o serif (Playfair) nos headlines ou ir 100% sans (Inter 800) como a ZK
3. Se quer que eu também já adapte mobile na primeira rodada ou faça desktop primeiro
