# Plano — Hero nova + Notificações discretas no rodapé

## 1. Hero (Landing.tsx)

Trocar o headline e subtítulo atuais por:

- **H1**: `O aplicativo que faz a sacoleira vender de verdade.`
  - Destaque `vender de verdade` com `neon-text` (mesmo tratamento de "estratégia" hoje).
- **Subtítulo**: `Comunidade de membros ativa com muita estratégia nova todos os dias.`
- Remove os 2 parágrafos atuais ("O VyralLab mostra…" + "Pare de adivinhar…").
- CTA "Comece agora por R$24,75", microcopy, badges e prova social ficam como estão.

## 2. SalesNotifications — versão discreta no rodapé

Refatorar `src/components/landing/SalesNotifications.tsx`:

- **Posição**: fixed no **rodapé central** (`bottom`), tanto mobile quanto desktop. No mobile fica **acima** do StickyCheckoutBar (offset `bottom: ~84px + safe-area`) para não sobrepor. No desktop, canto inferior esquerdo a ~16px do fundo.
- **Visual claro**:
  - Fundo `bg-white/95` com `backdrop-blur`
  - Borda `border-black/5`, sombra suave `shadow-lg`
  - Texto em tom escuro (`text-zinc-800` / `text-zinc-500` para o "há X min")
  - Sem a bolinha de avatar com inicial
  - Pequeno ícone `CheckCircle2` verde à esquerda (12-14px) como único ornamento
- **Tamanho menor**: ~300px de largura, padding reduzido (px-3 py-2), texto 12-13px.
- **Conteúdo igual**: nome + cidade + plano + método + tempo.
- **Comportamento**: mesma lógica (15s inicial, 18-35s entre, 5s visível, pausa em background, dismiss com X).

## 3. Arquivos afetados

- `src/pages/Landing.tsx` — copy do hero.
- `src/components/landing/SalesNotifications.tsx` — reposicionar + restyle claro + remover avatar.

Sem mudanças em backend, preços, checkout ou outras seções.
