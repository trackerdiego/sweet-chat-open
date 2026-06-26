
# Auditoria da landing — por que 1.431 visitas viraram só 108 cliques pra /auth

Tráfego de hoje: 99% mobile, 76% vindo de `l.instagram.com` (link na bio), 83% bounce, 90s de sessão média. Auditei o app com viewport mobile (390x844) e User-Agent do Instagram in-app. Encontrei **6 problemas críticos** ordenados por impacto na conversão.

---

## 🔴 P1 — Banner "Abra no Safari" cobre 30% da dobra inicial (impacto altíssimo)

O `InAppBrowserBanner` é fixed top e ocupa **~270px de 844px** da viewport mobile. Em **toda** screenshot (01 até 12) ele continua lá, roubando espaço do hero, dos depoimentos, do preço, de TUDO. É literalmente o primeiro elemento que o visitante do Instagram vê — antes mesmo do headline.

**Pior:** o copy diz "Abra no Safari pra instalar o app" — mas a pessoa **ainda não decidiu se quer instalar**. Estamos pedindo um esforço (sair do Instagram, abrir o Safari) antes da pessoa entender o produto.

**Fix:**
- Reduzir o banner a uma **barra slim de ~48px** ("📱 Pra instalar como app, abra no Safari ↗") em vez de card-tutorial gigante.
- Mover o detalhe ("Como instalar") pra um modal acionado por toque, não inline.
- Mostrar o banner **só depois do primeiro scroll** (>600px), nunca cobrindo o hero.

---

## 🔴 P2 — Preço está enterrado na dobra ~14 (impacto altíssimo)

A página tem 15 dobras. O bloco de preço (`R$47/mês`) só aparece no final. O usuário do Instagram, em sessão média de 90s, **não rola 15 telas**. Ele decide em ≤3 dobras se vale a pena clicar no CTA.

**Fix:**
- Adicionar **preço-âncora visível na dobra inicial**, abaixo do CTA principal:
  `"A partir de R$24,75/mês · 7 dias garantia"`
- Adicionar um **CTA sticky/flutuante** que aparece após scroll de 800px com "Assinar por R$24,75/mês →" — persiste enquanto a pessoa rola, em vez de obrigá-la a chegar ao final.

---

## 🟠 P3 — CTA "Começar agora" vai pra /auth, não pra checkout (impacto alto)

O hero diz "Começar agora" → leva pra tela de login/cadastro. A pessoa nem viu o preço ainda. Atrito puro: ela pensa "vou ter que criar conta sem saber o que custa".

**Fix duas opções (pergunta abaixo):**
- (A) Trocar copy do CTA pra **"Ver planos"** → faz scroll suave pro bloco de pricing.
- (B) Manter "Começar agora" mas adicionar microcopy embaixo: `"Grátis pra testar · cartão só na assinatura"`.

---

## 🟠 P4 — Hero sem prova social visceral acima da dobra (impacto médio-alto)

Hoje a dobra mostra: headline + 2 parágrafos longos + 2 CTAs + avatares + "1.200 criadores ativos". Problema:
- Os **dois parágrafos descritivos** ("Mais rápido, mais profundo..." + "Em poucos cliques...") são redundantes e empurram o CTA pra baixo.
- "1.200 criadores" é fraco — sem rosto, sem nome.

**Fix:**
- Cortar o segundo parágrafo. Manter só subheadline curta.
- Trocar "+1.200 criadores ativos" por **"⭐ 4.9/5 · +1.200 criadores · scripts gerados hoje: [contador realtime]"** (já tem o `RealtimeTracker` no projeto — usá-lo no hero).

---

## 🟡 P5 — Seção "dor" longa demais antes da solução (impacto médio)

Entre o hero e a primeira menção do produto ("E se uma IA criasse tudo em minutos?") tem **3 cards de dor** + título grande "mas ninguém vê". São 4 dobras de scroll só de dor antes de oferecer alívio. No Instagram, isso perde gente.

**Fix:**
- Reduzir de 3 cards de dor pra **1 card consolidado** + título.
- Ou mover a seção de dor pra **depois** do "como funciona em 3 passos", como reforço.

---

## 🟡 P6 — Faltam sinais de confiança próximos ao CTA (impacto médio)

CTA do hero não tem: garantia, cancelamento, segurança de pagamento, badge "sem cartão pra testar". Tudo isso aparece, mas espalhado e muito depois.

**Fix:** Linha de microbadges abaixo do CTA principal: `🔒 Pagamento seguro · ↩️ Cancele quando quiser · 🇧🇷 Pix e cartão`

---

## Plano de implementação (ordem de execução)

```text
1. P1 → Encolher InAppBrowserBanner pra slim bar 48px + delay de scroll
2. P3 → Decidir A ou B no CTA hero (pergunta abaixo)
3. P2 → Adicionar preço-âncora no hero + CTA sticky pós-scroll
4. P4 → Cortar parágrafo redundante + integrar RealtimeTracker no hero
5. P6 → Linha de microbadges sob o CTA
6. P5 → Consolidar seção de dor (3 cards → 1)
```

**Arquivos afetados:** `src/components/InAppBrowserBanner.tsx`, `src/pages/Landing.tsx`, e provavelmente um novo `src/components/landing/StickyCheckoutBar.tsx`.

**Sem mudanças no backend, sem mudanças no checkout, sem mudanças no preço.** Só frontend da landing.

---

## Pergunta antes de implementar

No **P3**, qual versão do CTA hero você prefere?
- **(A)** "Ver planos" → scroll suave pro pricing (menos atrito, mais transparente).
- **(B)** Manter "Começar agora" → /auth, mas com microcopy "Grátis pra testar".
- **(C)** Versão híbrida: "Ver planos" como CTA primário + "Começar agora" como link secundário pequeno.

Me responda A, B ou C (ou descreva outra) e eu já parto pra implementação completa dos 6 pontos.
