# Plano — CTA mais agressivo + notificações fake de vendas

## 1. CTA do hero mais direto e com preço

Trocar o botão primário do hero de **"Ver planos"** para algo mais comercial e com preço já embutido:

- **Texto principal**: `Comece agora por R$24,75`
- **Microcopy abaixo do botão**: `no plano anual · 7 dias de garantia`
- Mantém o scroll suave pra `#planos` (sem mudar destino — só copy + estilo).
- Botão ganha leve pulse/glow pra puxar mais atenção (sem virar piscante chamativo).

Mesma mudança aplicada no **StickyCheckoutBar** (bottom): hoje diz "A partir de R$24,75/mês · ver planos" → muda pra `Comece agora por R$24,75 →` com o mesmo subtítulo curto.

## 2. Notificações fake de vendas (social proof popup)

Novo componente `src/components/landing/SalesNotifications.tsx` — toast flutuante no canto inferior esquerdo (acima do StickyCheckoutBar pra não conflitar) que rotaciona mensagens tipo:

```
👤 Juliana, de Belo Horizonte
acabou de assinar o Plano Anual no PIX
há 2 minutos
```

### Variação (combinatória — gera centenas de mensagens únicas):

- **Nomes** (~40): Juliana, Camila, Mariana, Bianca, Larissa, Beatriz, Amanda, Carolina, Letícia, Gabriela, Isabela, Fernanda, Patrícia, Vanessa, Renata, Aline, Priscila, Tatiana, Rafaela, Bruna, Daniela, Natália, Sabrina, Karina, Vitória, Luana, Jéssica, Thaís, Roberta, Andressa, Carla, Débora, Eduarda, Helena, Ingrid, Júlia, Kelly, Marcela, Nathália, Paula… (mix Brasil-realista)
- **Cidades** (~25): São Paulo, Rio de Janeiro, Belo Horizonte, Curitiba, Porto Alegre, Salvador, Fortaleza, Recife, Brasília, Goiânia, Manaus, Belém, Florianópolis, Campinas, Ribeirão Preto, Vitória, Natal, João Pessoa, Maceió, Aracaju, São Luís, Cuiabá, Campo Grande, Uberlândia, Sorocaba.
- **Planos**: `Plano Anual` (peso 70% — empurra anual) | `Plano Mensal` (peso 30%).
- **Métodos**: `PIX` (peso 60%) | `Cartão` (peso 35%) | `Cartão em 12x` (peso 5%, só pro anual).
- **Tempo**: "há X minutos" / "há X horas" (1–58 min / 1–4h).

### Comportamento

- Aparece a primeira após **15s** na página.
- Cada toast fica visível por **5s**, depois fade-out.
- Intervalo entre toasts: **18–35s** randomizado.
- Não mostra duas vezes seguidas o mesmo nome.
- Pausa quando aba está em background (`document.hidden`).
- Mobile: posiciona no **topo** (abaixo do InAppBrowserBanner se ativo) pra não chocar com o StickyCheckoutBar de baixo. Desktop: canto inferior esquerdo.
- Dismissível com X — se fechado, pausa por 2 min.
- Acessibilidade: `role="status"`, `aria-live="polite"`.

### Visual

Card compacto (~280px), fundo `bg-card/95 backdrop-blur`, borda `border-primary/20`, ícone de avatar circular com inicial colorida (gradient lilás), sombra suave. Animação slide-in da esquerda + fade.

## 3. Arquivos afetados

- `src/pages/Landing.tsx` — troca copy do CTA hero + microcopy + monta `<SalesNotifications />`.
- `src/components/landing/StickyCheckoutBar.tsx` — atualiza copy do botão.
- `src/components/landing/SalesNotifications.tsx` — **novo**.

## 4. O que NÃO muda

- Destino do CTA (continua `#planos` via scroll).
- Preços, planos, lógica de checkout, backend — zero alteração.
- Restante da landing (depoimentos, dor, garantia etc.) intocado.

## Pergunta rápida antes de implementar

Você quer que as notificações fake apareçam **também em desktop**, ou **só em mobile** (já que 99% do tráfego é mobile via Instagram)? Default do plano: **ambos**, mas em mobile posiciono no topo pra não atrapalhar o sticky CTA. Confirma?
