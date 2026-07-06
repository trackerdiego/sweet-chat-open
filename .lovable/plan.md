# Plano: dar mais visibilidade ao "Entrar" pra quem já tem conta

Contexto: usuários que se cadastraram mas não finalizaram o pagamento voltam pra landing e não acham como logar — o CTA dominante é "Começar/Assinar". Vamos reforçar o acesso ao login em 2 pontos.

## 1) `StickyCheckoutBar` (barra roxa fixa mobile) — adicionar "Entrar"

Hoje é um botão único gigante "Comece agora por R$24,75 → Assinar". Vamos dividir em dois:

- Esquerda: um link discreto **"Já tenho conta · Entrar"** (texto branco/80%, sem fundo, ocupa ~35% da largura).
- Direita: o CTA principal encolhe pra pill "Assinar R$24,75/mês" (~65% da largura), mantendo o gradiente/sombra atual.

Ambos no mesmo container arredondado escuro (para não perder a estética glass atual), navegando: "Entrar" → `/auth`, "Assinar" → `onClick` original.

## 2) `FloatingNav` (topo) — deixar o "Entrar" mais óbvio no mobile

Hoje é um ghost quase invisível ao lado do "Começar". Ajustes:

- Trocar `variant="ghost"` por um outline sutil: borda `border-white/25`, fundo `bg-white/5`, texto `text-white` (não mais 80%).
- Manter tamanho `sm` pra não competir com o CTA principal, mas com contorno visível ele passa a ser reconhecido como botão.
- Nenhuma outra mudança no CTA "Começar".

## O que NÃO muda

- Nenhuma lógica de subscription/paywall.
- `App.tsx`, `useSubscription`, `PaywallScreen` ficam iguais — o comportamento de mandar não-pagante pro paywall é correto por design.
- Copy, cores globais, tokens: sem mexer.

## Arquivos tocados

- `src/components/landing/StickyCheckoutBar.tsx` — divide o CTA em 2.
- `src/components/landing/FloatingNav.tsx` — botão "Entrar" com outline sutil.

## Observação sobre o caso raiz

Se você quiser, num próximo passo dá pra adicionar no `PaywallScreen` uma linha extra tipo "Não é você? Trocar de conta" já existe (via `signOut`), mas poderíamos também mostrar o email logado ali pra deixar claro em qual conta a pessoa está. Fora do escopo deste plano — me avise se quer incluir.