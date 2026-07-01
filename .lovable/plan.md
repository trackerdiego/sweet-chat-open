## Objetivo
Na tela de sucesso do checkout (bloco `isActive` dentro do `CheckoutModal`, que é o "obrigado" atual após pagamento aprovado), adicionar acesso ao grupo de WhatsApp dos alunos, reforçando que o VyralLab é mais que uma ferramenta — é um grupo de aceleração de vendas.

## Onde entra
`src/components/CheckoutModal.tsx`, dentro do bloco de sucesso (`{isActive && ...}`, linhas 486–550), entre o resumo do plano e o botão "Começar onboarding".

## O que será adicionado
Um card de destaque com:

- Ícone do WhatsApp (`MessageCircle` do lucide, com cor verde-whatsapp via classe utilitária) dentro de um badge circular.
- Título curto: **"Mais que uma ferramenta: um grupo de aceleração de vendas"**.
- Subtítulo: **"Entre no grupo exclusivo de alunos do VyralLab e acelere seus resultados junto com quem já está vendendo."**
- Botão primário verde WhatsApp: **"Entrar no grupo de alunos"** com ícone, abrindo `https://chat.whatsapp.com/D6gLGgzZvcW1UCDHlP1uR0?s=sh&p=i&mlu=4&amv=2` em nova aba (`target="_blank"`, `rel="noopener noreferrer"`).

O botão "Começar onboarding" continua logo abaixo, agora como ação secundária visual (mantém `gold-gradient`, mas a hierarquia visual passa a ter o WhatsApp como primeiro CTA de comunidade e o onboarding como próximo passo do produto). O redirecionamento automático atual é mantido — o usuário vê o card do grupo antes de ser levado ao onboarding, e pode abrir o WhatsApp em nova aba sem perder o fluxo.

## Detalhes técnicos
- Link definido como constante no topo do arquivo: `const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/D6gLGgzZvcW1UCDHlP1uR0?s=sh&p=i&mlu=4&amv=2';`.
- Cor verde do WhatsApp aplicada via classes Tailwind arbitrárias apenas no botão do grupo (`bg-[#25D366] hover:bg-[#1ebe5d] text-white`) — exceção pontual justificada por ser cor de marca de terceiro, não do design system.
- Sem novas dependências, sem mudança em rotas ou lógica de assinatura.

## Fora de escopo
- Não criar página `/obrigado` separada (o fluxo atual já usa o modal como tela de sucesso; criar rota nova mudaria o comportamento de redirect e o pós-pagamento por PIX).
- Não alterar backend/webhook.
