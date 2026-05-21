## Objetivo
Trazer o mesmo padrão visual do Painel (`/`) para as telas internas, mantendo o layout atual de cada uma — só harmonizando fundo, header e cards.

## Padrão alvo (já existente em `src/pages/Index.tsx` + `src/index.css`)
- Fundo: `min-h-screen pb-24 md:pt-20 relative overflow-hidden` + orbs neon roxos/magenta no modo dark (`.app-neon-orb`).
- Header hero: bloco com título serif + subtítulo dentro do **mesmo container do conteúdo** (sem o bloco roxo chapado que existe hoje). Padding `pt-[max(1.5rem,env(safe-area-inset-top))]`.
- Card destaque (quando a tela tiver um): `.app-hero-gradient` no lugar do antigo `gradient-header`.
- Cards internos: `.app-neon-border` (versão padrão para CTA, `.soft` para listas/itens).
- Chips/badges: `.app-neon-chip`.
- Botões e ícones de ação: variantes `ghost` já em uso, mantendo `text-foreground/70`.

## Telas a atualizar
| Tela | Arquivo | Tratamento |
|---|---|---|
| Matriz | `src/pages/Matrix.tsx` | Remover `.gradient-header`. Header em `max-w-lg mx-auto` com título serif. Filtros de pilar viram `.app-neon-chip`. Cards dos 30 dias ganham `.app-neon-border.soft`; dia atual usa `.app-neon-border` (acento). Skeleton idem. |
| Tarefas | `src/pages/Tasks.tsx` | Substituir `.gradient-header` por header hero (greeting "Tarefas" + dia/data). Card do dia atual em `.app-hero-gradient`. Lista `DailySchedule` mantém shadcn, só envelopa em `.app-neon-border.soft`. |
| Ferramentas | `src/pages/Tools.tsx` | Adicionar orbs + header serif. Substituir `glass-card` dos `ToolCard` por `.app-neon-border.soft` (mantém hover). `bg-primary/10` do ícone vira chip com mesma cor neon. |
| Carteira | `src/pages/Wallet.tsx` | Header hero + saldo em `.app-hero-gradient`. Lista de transações em `.app-neon-border.soft`. |
| Indique | `src/pages/Referral.tsx` | Header hero. Cartão de link de indicação em `.app-hero-gradient`. Steps/recompensas em `.app-neon-border.soft`. |
| Ajuda | `src/pages/Help.tsx` | Header hero. Cards de FAQ/contato em `.app-neon-border.soft`. |
| Script | `src/pages/Script.tsx` | Header hero. Card principal do roteiro em `.app-neon-border` (acento), seções em `.app-neon-border.soft`. |

## Fora de escopo
- Estrutura de informação, ordem dos blocos, lógica de dados — tudo permanece.
- Landing, Auth, Admin, Onboarding, Renew, ResetPassword, NotFound — não tocadas.
- Sem mudar tokens globais em `index.css` (paleta já está definida); só consumo via utilities existentes.

## Verificação
- Smoke visual em cada rota (light + dark) confirmando: fundo branco/limpo no light, orbs neon no dark, header sem bloco chapado, cards com borda neon sutil.
- Garantir que botões de "voltar"/`HelpButton` continuam clicáveis sobre o novo fundo (z-index `relative z-10` nos wrappers).

## Entrega VPS
Frontend hospedado na Vercel via GitHub; basta merge no `main`. Bloco copy-paste no fim da resposta de implementação.