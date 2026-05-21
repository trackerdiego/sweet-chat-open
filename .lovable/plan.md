## Problema atual

Hoje o funil tem fricção mortal:

1. Visitante clica **"Começar agora"** na landing → rola até a seção de planos
2. Clica em **"Assinar plano anual"** → vai para `/auth?plan=yearly`
3. `/auth` abre em modo **LOGIN por padrão** (`isLogin=true`) e **ignora completamente o `?plan=`**
4. Visitante novo tenta logar → erro → precisa achar o link "Criar conta" → faz signup
5. Após signup cai no app/onboarding, e o modal de pagamento **só aparece depois** quando o `AccessGuard` bloqueia (e ainda assim sem plano pré-selecionado)

Resultado: muita gente desiste no meio. Sem freemium, isso mata conversão.

## Fluxo proposto (mínima fricção)

```text
Landing
  ↓ "Começar agora" (hero / CTA final / nav)
Seção #planos
  ↓ "Assinar plano X"
/auth?plan=yearly&mode=signup     ← já abre em SIGNUP, com banner do plano
  ↓ cria conta (sem confirmação de email — já está desativado)
/onboarding?openCheckout=yearly   ← redirect pós-signup
  ↓ CheckoutModal abre AUTOMATICAMENTE com plano pré-selecionado
  ↓ usuário preenche dados → paga
Sucesso Asaas → libera app
```

Mantemos o login como alternativa visível ("Já tenho conta") mas o **default vira signup** quando vem com `?plan=`.

## Mudanças

### 1. `src/pages/Auth.tsx`
- Ler `?plan=` e `?mode=` na URL.
- Se `plan` presente OU `mode=signup` → `setIsLogin(false)` no mount.
- Guardar `plan` em `sessionStorage` (`pending_checkout_plan`) antes do `signUp`.
- Adicionar um banner no topo do form mostrando "Você selecionou o plano Anual — R$297/ano" quando vier com plano, pra reforçar a intenção.
- Após signup bem-sucedido, redirecionar para `/?openCheckout=<plan>` (ou onboarding com flag) em vez do destino padrão.

### 2. `src/App.tsx` ou novo hook
- Detectar `?openCheckout=<plan>` na URL após login.
- Abrir `CheckoutModal` automaticamente com `selectedPlan` pré-setado.
- Limpar o query param após abrir.

Implementação: criar `src/components/AutoCheckoutOpener.tsx` que:
- Lê `sessionStorage.pending_checkout_plan` OU `?openCheckout=`
- Renderiza `<CheckoutModal open=true onOpenChange=... initialPlan=...>`
- Limpa storage + URL ao fechar/abrir

Plugar dentro do bloco autenticado de `AppRoutes`.

### 3. `src/components/CheckoutModal.tsx`
- Aceitar prop opcional `initialPlan?: "monthly" | "yearly"` para pré-selecionar.

### 4. `src/pages/Landing.tsx`
- Os botões já mandam `?plan=monthly` e `?plan=yearly` — manter, mas adicionar `&mode=signup` pra explicitar.
- Botão "Entrar" no `FloatingNav` continua indo pra `/auth` em modo login normal (pra quem já tem conta).

### 5. `src/components/AccessGuard.tsx`
- Sem mudança funcional, mas o caminho do trial expirado já abre `CheckoutModal` corretamente. Garantir consistência usando `initialPlan` se quisermos default `"yearly"`.

## Por que essa é a forma mais otimizada

- **1 clique a menos**: usuário não cai mais em tela de login que ele não consegue passar.
- **Intenção preservada**: o plano escolhido na landing chega no modal sem precisar reescolher.
- **Reforço visual**: o banner "Você selecionou o plano Anual" no signup aumenta compromisso (commitment bias).
- **Sem regressão pra login**: quem clica em "Entrar" no nav continua tendo a experiência de login normal.
- **Compatível com Asaas atual**: a edge `create-asaas-subscription` exige JWT, então o signup ANTES do pagamento continua necessário — a otimização é tornar esse passo invisível/inevitável, não pular.

## Itens fora do escopo desta correção
- Trocar provedor de pagamento (Asaas continua).
- Mexer em onboarding em si — apenas a abertura automática do modal.
- Email de boas-vindas (já existe).
