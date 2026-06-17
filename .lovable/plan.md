## Reverter modo teste e voltar ao checkout padrão R$297 (12x)

### O que será removido

**1. `src/components/CheckoutModal.tsx`**
- Remover state `hasTestToken` e a leitura de `localStorage.getItem("__test_mode_token")`.
- Remover state `testMode` e o checkbox `🧪 MODO TESTE`.
- Remover o envio do `__testMode` no payload e do header `x-test-mode-token` no `invoke`.
- Manter o fluxo padrão: anual R$297 em até 12x via cartão.

**2. `supabase/functions/create-asaas-subscription/index.ts`**
- Remover a constante `TEST_MODE_PRICE`.
- Remover a leitura do header `x-test-mode-token` e a comparação com `TEST_MODE_SECRET`.
- Remover o branch que substitui o preço por R$5 e qualquer log/condicional de teste.
- Remover `x-test-mode-token` do `Access-Control-Allow-Headers`.
- Manter o cálculo normal de parcelamento (anual R$297, até 12x).

**3. `.lovable/plan.md`**
- Remover a seção do plano de modo teste.

### Verificação após revert
- Abrir checkout → etapa Pagamento → Cartão deve mostrar `Pagar R$297` com opção de 12x, igual à imagem.
- Nenhum checkbox de modo teste visível.
- Nenhum efeito mesmo se sobrar `__test_mode_token` no localStorage do navegador.

### Comandos na VPS (para você rodar depois)

Limpar a variável `TEST_MODE_SECRET` que adicionamos:

```bash
cd ~/supabase/docker

# 1) Remover a linha TEST_MODE_SECRET do .env
sed -i '/^TEST_MODE_SECRET=/d' .env

# 2) Remover a linha TEST_MODE_SECRET: ${TEST_MODE_SECRET} do docker-compose.yml
#    (faça backup antes; ajuste se a indentação for diferente)
cp docker-compose.yml docker-compose.yml.bak
sed -i '/TEST_MODE_SECRET:\s*\${TEST_MODE_SECRET}/d' docker-compose.yml

# 3) Recriar o container functions sem a env var
docker compose up -d --force-recreate functions
```

Depois redeployar a function já limpa:

```bash
cd /root/app
git pull
./scripts/deploy-selfhost.sh create-asaas-subscription
```

(Opcional, no navegador, para limpar o token que você tinha tentado setar:)

```js
localStorage.removeItem('__test_mode_token')
```

### Resultado final
Checkout volta 100% ao estado anterior — anual R$297 com 12x no cartão — e você valida o fluxo na prática quando o primeiro cliente fechar o anual parcelado.