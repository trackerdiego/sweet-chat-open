## Problemas identificados

1. **Modal feio e morto** — header com `Playfair Display` (serif) que destoa do resto, sem hierarquia visual, sem energia, fundo `bg-card/95` chapado, sem profundidade roxa de verdade.
2. **Sem gatilhos de conversão** — não tem empilhamento de bônus, vantagens visíveis, prova social, escassez/urgência, garantia. Checkout de R$297 sem nada disso converte mal.
3. **Bug crítico de perda de estado** — ao trocar de aba do navegador e voltar, o modal "reseta": o usuário cai de volta na etapa de dados e perde tudo que digitou. Causa: o `step`, dados do formulário e `pix` vivem só em `useState` local do `CheckoutModal`; quando algum re-render externo (ex.: `useSubscription` refazendo fetch ao readquirir foco, ou o `AccessGuard`/rota remontando) desmonta e remonta o componente, o state vai pro lixo.

## Correções (sem mexer em backend)

### A. Persistência do checkout (bug do "voltei e perdi tudo")

- **Persistir progresso em `sessionStorage`** com a chave `checkout:v1`:
  - `step`, `selectedPlan`, `method`, todos os campos de dados (`name`, `email`, `cpfCnpj`, `phone`, endereço completo), e — se já gerado — o `pix` (encodedImage + payload).
  - Hidratar no mount; salvar em `useEffect` com debounce.
  - Limpar a chave quando: modal fecha por sucesso (`isActive` virar true) OU usuário clicar num novo botão "Recomeçar".
- **Não desmontar o modal quando perder foco**: revisar se `CheckoutModal` está dentro de algum componente que remonta via `key` mudando. Se sim, içar pra fora ou estabilizar a key.
- Resultado: trocar aba, fechar sem querer, ou recarregar a página mantém o usuário exatamente onde estava, com PIX já gerado ainda visível e o polling retomando.

### B. Redesign visual (purple/glass de alta conversão)

Sem trocar a paleta do projeto — só usar melhor o que já existe (`--primary 258 60% 55%`, `--accent 280 65% 60%`, `gold-gradient`, `glass-card`).

- **Tipografia**: remover `font-serif` do título. Usar `Inter` semibold/bold com tracking apertado pra ficar moderno. Reservar serifa só pra preço grande (efeito editorial).
- **Header com vida**:
  - Fundo aurora: dois `radial-gradient` em `hsl(var(--primary)/0.25)` e `hsl(var(--accent)/0.2)` com blur, animados sutilmente (Motion).
  - Barra de progresso (3 dots: Dados → Pagamento → Confirmação) no topo, com o ativo em `gold-gradient`.
  - Selo "Pagamento 100% seguro" com ícone shield e badge Asaas pequena.
- **Bloco de bônus empilhados** (visível em todas as etapas, sticky no topo do conteúdo):
  ```
  ✓ Acesso completo Influ Lab          R$ 297
  ✓ Bônus: 30 dias de matriz custom    R$ 197  GRÁTIS
  ✓ Bônus: Banco de hooks virais       R$  97  GRÁTIS
  ✓ Bônus: IA de roteiros ilimitada    R$ 147  GRÁTIS
  ─────────────────────────────────────────────
  Valor total:  R$ 738    Você paga: R$ 297
  ```
  Estilo: cards translúcidos com `border-primary/20`, valores "riscados" em muted, "GRÁTIS" em pill `gold-gradient`.
- **Gatilhos de escassez/urgência**:
  - Banner topo: ⚡ "Oferta de lançamento — preço sobe em [contador 47:23:12]" (countdown puramente visual, baseado em data fixa de campanha).
  - "🔥 X criadores assinaram nas últimas 24h" (número estático ou vindo do `admin-launch-health` se já existir endpoint público).
- **Garantia**: bloco verde-acizentado com `ShieldCheck` "7 dias de garantia — se não amar, devolvemos 100%".
- **Cards de plano**: anel animado `bg-gradient-to-r` rodando no selecionado, badge "MAIS ESCOLHIDO" no anual com `gold-gradient`, parcela "12x R$24,75" destacada.
- **Inputs**: agrupar em "cards" com label flutuante leve, `bg-background/40` + `backdrop-blur-md` + `border-border/40 focus:border-primary focus:ring-primary/30`, transições suaves.
- **CTAs**: `gold-gradient` com glow `shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.6)]`, micro hover lift, ícone sempre.
- **Tela de resultado PIX**:
  - QR centralizado em card branco arredondado com glow roxo.
  - Bloco "⏱ Aguardando pagamento — geralmente cai em 10s" com spinner roxo.
  - Passo-a-passo numerado (1. Abra seu banco / 2. Escolha PIX / 3. Escaneie ou cole).
  - Botão copia-e-cola GIGANTE como ação primária.

### C. Aproveitar `admin-launch-health` (responder dúvida do user)

Você está certo — a `LaunchHealthDashboard` em `/admin` já mostra a saúde do webhook (eventos recebidos, processados, falhas). Vou **incluir no plano a verificação visual via essa tela** em vez de pedir queries manuais. Se ela mostrar webhook ok + assinatura ativa do cliente que pagou, está tudo certo, sem necessidade de retrabalho.

## Arquivos afetados

- `src/components/CheckoutModal.tsx` — redesign completo + hook de persistência em sessionStorage.
- `src/hooks/useCheckoutDraft.ts` *(novo)* — encapsula save/load/clear do rascunho.
- `src/components/checkout/BonusStack.tsx` *(novo)* — bloco de bônus reutilizável.
- `src/components/checkout/UrgencyBar.tsx` *(novo)* — countdown + social proof.
- Nenhum arquivo de backend, nenhuma migration, nenhum deploy de edge function.

## Critérios de aceite

- Trocar aba do Chrome, voltar 5min depois → PIX ainda visível, polling ativo, dados intactos.
- Modal abre exibindo: progresso, bônus empilhados, urgência, garantia, plano destacado.
- Zero `font-serif` no título; zero cor hardcoded; tudo via tokens HSL do design system.
- Build passa, sem warnings novos.