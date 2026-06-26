
# Nova copy do Hero (sessão 1)

Substituir apenas os textos do hero em `src/pages/Landing.tsx` (linhas ~152–169). Mantém layout, CTAs, badges de preço, prova social e mockup intactos.

## O que muda

**Chip (linha 152–156)** — de "A IA por trás dos criadores que crescem" para algo direto à dor:
> ⚠️ Pare de postar todo dia sem vender

**H1 (linha 158–165)** — headline agressiva, foco em vender pelo WhatsApp:
> **Pare de postar todo dia e continuar sem vender.**
> Com a palavra "vender" destacada em neon.

**Subheadline (linha 167–169)** — promessa concreta:
> Descubra exatamente o que suas clientes querem comprar e receba uma estratégia pronta pra criar conteúdo que gera pedido no WhatsApp todo dia.

**Lista de benefícios (NOVA, entre subheadline e CTAs)** — 4 bullets com ícones, compactos:
- 🚀 Entenda as dores e desejos das suas clientes
- 📲 Roteiros prontos pra postar todo dia
- 🛍️ Transforme seguidores em compradoras reais
- ⏱️ Economize horas pensando no que publicar

**Microcopy abaixo dos CTAs (opcional, leve)** — frase de fechamento:
> Comece agora e faça seu conteúdo trabalhar pra vender todo dia.

## O que NÃO muda
- Botões "Ver planos" / "Já tenho conta"
- Preço "A partir de R$24,75/mês · 47% off"
- Trust badges (pagamento seguro, cancele quando quiser, Pix/cartão)
- Estrelas 4.9/5 + avatares "+1.200 criadores"
- Imagem do mockup à direita
- Sticky CTA, FloatingNav, InAppBrowserBanner

## Detalhes técnicos
- Arquivo único: `src/pages/Landing.tsx`
- A lista de bullets entra como `<ul>` simples com Tailwind (`space-y-2 text-white/80 text-sm sm:text-base mb-7`), emojis inline pra não exigir novos imports de ícones.
- Sem alterações em outros componentes, sem mexer em dados/backend.

Confirma que posso aplicar?
