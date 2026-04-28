## Objetivo

Criar uma central de ajuda (`/ajuda`) começando pela documentação completa do sistema de coins. Adicionar um ícone de ajuda (HelpCircle) no header da Home, posicionado ao lado esquerdo do ícone de logout, conforme sugerido. A página é estruturada em seções para futuramente comportar tutoriais em vídeo de cada ferramenta.

## Onde fica o acesso

No `src/pages/Index.tsx` (linhas 60-67), o header já tem um `flex items-center justify-between`. Vamos transformar o lado direito em um grupo com 2 botões:

```
[Dia 27 de 30]              [?] [↗ logout]
```

Ambos no mesmo padrão visual `text-white/70`, ghost icon button. O `?` (HelpCircle) navega para `/ajuda`.

## Nova rota: /ajuda

Adicionar `<Route path="/ajuda" element={<Help />} />` em `src/App.tsx`. Página acessível para qualquer usuário autenticado (não precisa estar dentro do `AccessGuard` se quisermos disponível mesmo sem assinatura — vou deixar **dentro** do AccessGuard para manter consistência, mas adicionar `/ajuda` à whitelist do guard se ele bloquear; verifico no momento da implementação).

## Estrutura da página Help

Arquivo novo: `src/pages/Help.tsx`. Layout no mesmo padrão visual de `/carteira`:

- **Gradient header** com título "Central de ajuda" e subtítulo "Tire suas dúvidas e aproveite ao máximo".
- **Lista de seções em accordion** (`@/components/ui/accordion` — já existe):
  1. Como funcionam as Coins (expandida por padrão)
  2. Tutoriais em vídeo *(placeholder com badge "Em breve")*
  3. Suporte e contato *(placeholder simples com link/email)*

O accordion permite adicionar novas seções (vídeos por ferramenta) sem reestruturar a página.

## Conteúdo da seção "Como funcionam as Coins"

Documentação baseada no que já está implementado (`award-task-coins`, `apply-monthly-discounts`, `useWallet`, página `/carteira`):

1. **O que são coins** — moeda interna que vira desconto automático na sua mensalidade. 1 coin = R$ 0,01.
2. **Como ganhar**:
   - Concluindo tarefas diárias: **+10 coins** por tarefa.
   - Bônus de streak: **+50 coins** a cada 7 dias consecutivos de uso.
   - Indicações pagas: créditos em R$ direto na carteira (referenciar `/indique`).
3. **Como usar** — não precisa fazer nada. No vencimento da fatura mensal, o sistema aplica automaticamente o desconto correspondente ao seu saldo + créditos de indicação. Saldo zera após o desconto e volta a acumular.
4. **Limites e regras**:
   - Desconto máximo: valor cheio do plano (R$ 47 mensal / R$ 397 anual).
   - Coins não expiram enquanto a assinatura estiver ativa.
   - Se o pagamento falhar, o desconto é revertido e seus coins voltam.
5. **Onde ver seu saldo** — link/botão para `/carteira`.
6. **FAQ rápido** (3-4 perguntas curtas):
   - "Posso sacar coins em dinheiro?" → Não, são apenas desconto.
   - "Perco coins se cancelar?" → Sim, são vinculados à assinatura ativa.
   - "Quanto tempo até virar desconto?" → Aplicado na próxima cobrança mensal.

Tudo em texto curto, escaneável, com ícones (`Coins`, `Trophy`, `Gift`, `Tag` do lucide-react já em uso).

## Arquivos afetados

- `src/pages/Help.tsx` — novo (página).
- `src/App.tsx` — adicionar rota `/ajuda`.
- `src/pages/Index.tsx` — adicionar botão `HelpCircle` ao lado do logout no header.
- `src/components/AccessGuard.tsx` — verificar e, se necessário, liberar `/ajuda` (página de ajuda nunca deve ser bloqueada por paywall).

## Deploy

Frontend-only (Vercel auto-deploy do GitHub). Sem comandos VPS, sem migrations, sem edge functions.
