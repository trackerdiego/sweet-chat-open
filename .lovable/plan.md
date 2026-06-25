# Celebração pós-pagamento + redirect para onboarding

## Diagnóstico do fluxo atual

```text
Landing → /auth?plan=X → Signup → AutoCheckoutOpener abre modal
   → step "data" → "method" → "result" (PIX QR ou cartão)
   → polling refresh() detecta isActive=true
   → toast 1.2s "Pagamento confirmado" → modal fecha
   → usuário fica parado na rota onde estava (geralmente /)
```

**Problemas:**
1. Sem celebração — só um toast de 1,2s some rápido demais.
2. Sem comunicação de "próximos passos" — usuário não entende que precisa fazer onboarding.
3. Sem redirect explícito — depende do AccessGuard/trigger empurrar pra /onboarding.
4. Cartão aprovado mostra "Tudo certo!" mas o estado `isActive` pode demorar 2-5s (webhook Asaas) — janela de confusão.

**Benchmark de mercado** (Cal AI, Duolingo Super, Notion Plus, ChatGPT Plus, Superhuman): tela de sucesso com confete, badge "Premium", resumo do plano, mensagem "Vamos personalizar sua experiência", CTA único.

## O que vou implementar

### 1. Nova tela de sucesso DENTRO do CheckoutModal (`step === "result"` + `isActive`)
Substitui o atual "Tudo certo!" + toast efêmero por uma view celebratória de ~4s:

- Confete (canvas-confetti, ~250 partículas, paleta primary/accent)
- Ícone Crown animado (scale-in + glow)
- Headline: "Bem-vindo ao Premium 🎉"
- Subline: "Pagamento confirmado. Agora vamos personalizar tudo pra você."
- Card discreto com: plano escolhido, valor, próxima cobrança
- Checklist animado (3 itens aparecendo em sequência):
  - ✓ Conta criada
  - ✓ Pagamento confirmado
  - ⏳ Personalizando sua experiência
- CTA único: "Começar onboarding →"

### 2. Estados intermediários (enquanto polling não confirma)
- **Cartão processando** (`cardApproved && !isActive`): spinner + "Confirmando seu pagamento... (até 30s)" — já existe parcialmente, melhorar copy.
- **PIX aguardando**: mantém QR + adiciona texto "Esta tela atualiza sozinha quando o pagamento cair."

### 3. Redirect automático
Quando `isActive` vira true E o usuário clica no CTA (ou após 6s sem clique como fallback):
```ts
clear(); onOpenChange(false); navigate('/onboarding');
```
Remove o `setTimeout(1200)` atual que fecha sem direcionar.

### 4. Dependência
- `bun add canvas-confetti @types/canvas-confetti`

## Arquivos afetados

- `src/components/CheckoutModal.tsx` — refatora bloco `step === "result"` (linhas ~413-455) com sub-componente `<PaymentSuccessView />` interno; ajusta `useEffect` de auto-close (linhas 124-130) para navegar em vez de só fechar.
- `package.json` — nova dep `canvas-confetti`.

## Fora de escopo (posso fazer depois se quiser)

- Tela `/welcome` separada como rota.
- Email transacional de boas-vindas.
- Mudanças no Onboarding em si.
