## Problema

O modo teste atual depende do email `agentevendeagente@gmail.com`, mas:
1. Esse email já tem acesso premium → checkout nem aparece
2. Criar conta nova com outro email → backend não reconhece como admin → cobra R$297 real

## Nova estratégia: secret token no localStorage (desacopla do email)

Em vez de gatear o modo teste pelo email do usuário, usar um **token secreto** que você cola no console do navegador. Qualquer conta (nova ou antiga) com o token ativo vê o checkbox de teste e paga R$5.

### Como vai funcionar

1. **Você cria uma conta nova** (email descartável, ex: `teste+parcelas@gmail.com`) só pra simular um cliente novo
2. **No console do navegador** roda: `localStorage.setItem('__test_mode_token', 'SEGREDO_AQUI')`
3. Recarrega → checkout passa a mostrar o checkbox "🧪 MODO TESTE"
4. Marca o checkbox, escolhe parcelas (ex: 12x), paga R$5 com cartão real
5. Valida no Asaas que as 12 parcelas foram criadas + webhook ativou premium + assinatura de renovação agendada pra +365d
6. Cancela a assinatura de renovação no painel Asaas pra não cobrar de novo
7. Depois de validar, removemos todo o bloco de teste

### Mudanças

**Backend (`supabase/functions/create-asaas-subscription/index.ts`)**
- Trocar a checagem `user.email === "agentevendeagente@gmail.com"` por: `request header `x-test-mode-token` === `Deno.env.get("TEST_MODE_SECRET")`
- Mantém `TEST_MODE_PRICE = 5.0` e a lógica de recalcular parcelas
- Webhook description continua com `[TESTE]` pra rastrear

**Frontend (`src/components/CheckoutModal.tsx`)**
- Trocar `isAdmin` por `hasTestToken = !!localStorage.getItem('__test_mode_token')`
- Quando presente, manda o token no header `x-test-mode-token` da chamada `supabase.functions.invoke`
- Checkbox amarelo e label "Pagar R$5 (TESTE)" continuam iguais

**Novo secret no self-hosted**
- `TEST_MODE_SECRET` (você define um valor aleatório, ex: `tm_a1b2c3d4`)
- Adicionar em `~/supabase/docker/.env` + `environment:` do service `functions` no `docker-compose.yml` + `docker compose up -d --force-recreate functions`

### Por que isso resolve

- Não depende de email → qualquer conta nova funciona
- Token só você conhece → ninguém consegue ativar modo teste sem acesso ao localStorage E ao secret do backend (dupla camada)
- Conta de teste descartável → não polui sua conta principal nem trava por "já cadastrado"

### Comando pra você rodar depois do deploy

```
cd /root/app && git pull && ./scripts/deploy-selfhost.sh create-asaas-subscription
```

E no Studio self-hosted, antes do deploy, adicionar o secret `TEST_MODE_SECRET=<valor_que_voce_escolher>`.

### Sobre a conta antiga (`agentevendeagente@gmail.com`)

Não mexo nela. Você cria uma conta nova só pra esse teste. Depois de validar, pode deletar a conta de teste pelo Studio (`auth.users` + `subscription_state` + `user_profiles`).

---

**Confirma esse caminho?** Se sim, na build mode eu:
1. Refatoro o gate do `create-asaas-subscription` pra usar header + secret
2. Refatoro o `CheckoutModal` pra ler o token do localStorage
3. Te entrego o bloco de deploy + o secret pra você adicionar no `.env` da VPS