
User pergunta se um usuário novo (primeiro acesso) consegue: (1) criar cadastro, (2) usar o app, (3) pagar premium — tudo no contexto self-hosted.

Vou esclarecer a confusão de nomenclatura primeiro, depois validar o fluxo ponta-a-ponta lendo os pontos críticos.

## Esclarecimento: "uuid" vs "user_id" — não é divergência

Não tem divergência nenhuma. São a mesma coisa:
- `user_id` é o **nome da coluna** nas tabelas (`user_profiles.user_id`, `user_usage.user_id`, etc.)
- `uuid` é o **tipo de dado** dessa coluna
- O **valor** dentro dela é o `auth.users.id` do Supabase (também um UUID)

Tanto no Lovable Cloud quanto no self-hosted é idêntico: o `auth.uid()` do usuário logado vira o `user_id` (uuid) nas tabelas. A única diferença real é **onde o banco roda fisicamente** (`api.influlab.pro` vs Lovable Cloud) — o schema é o mesmo.

## Fluxo ponta-a-ponta de um usuário novo

Vou auditar os 4 pontos críticos:

### 1. Cadastro (signup)
- Componente: `src/pages/Auth.tsx`
- Aponta pra `https://api.influlab.pro` (confirmado em `client.ts`)
- Trigger `handle_new_user()` cria automaticamente row em `user_profiles` com `onboarding_completed=false`
- ✅ Esperado funcionar — mas preciso confirmar que a trigger existe **no self-hosted** também (no Lovable Cloud ela aparece, mas migrations Lovable não vão pro self-hosted)

### 2. Onboarding (4 etapas — análise visceral, matriz, etc.)
- Chama edge functions `generate-audience-profile`, `generate-personalized-matrix`
- Essas functions precisam estar deployadas **no self-hosted** com `GOOGLE_GEMINI_API_KEY` setado
- ✅ Já confirmado em memória (`mem://infra/backend-selfhosted`)

### 3. Uso normal (free tier)
- Hook `useUserUsage` cria row em `user_usage` no primeiro acesso (insert se não existir)
- Limites diários funcionam por data
- ✅ Lógica é client-side, não depende de nada extra no servidor

### 4. Pagamento premium
- `CheckoutModal` → `create-asaas-subscription` (passa `user.id` como `externalReference` no Asaas)
- Asaas processa → webhook bate em `https://api.influlab.pro/functions/v1/asaas-webhook`
- Webhook valida token (já testamos: ✅), pega `externalReference`, atualiza `user_usage.is_premium=true`
- ✅ Validado nos testes anteriores

## O que vou checar antes de confirmar "tudo ok"

Preciso ler 3 arquivos pra ter certeza absoluta:

1. **`src/pages/Auth.tsx`** — confirmar que signup não exige confirmação de email (memory diz que sim, mas valido)
2. **`supabase/functions/create-asaas-subscription/index.ts`** — confirmar que passa `externalReference = user.id` corretamente (essa é a cola que liga pagamento → ativação premium)
3. **`src/pages/Onboarding.tsx`** (rápido) — confirmar que não tem nada que quebre pra user novo

## Riscos conhecidos que não consigo validar daqui

- ⚠️ **Trigger `handle_new_user` no self-hosted**: existe no schema do Lovable Cloud. Se não foi rodada manualmente no Studio self-hosted, signup vai funcionar mas `user_profiles` ficará vazio → app quebra no onboarding. **Recomendo você confirmar no Studio self-hosted**:
  ```sql
  select tgname from pg_trigger where tgname = 'on_auth_user_created';
  ```
  Se vazio, precisa criar a trigger lá.

- ⚠️ **Edge functions no self-hosted**: `create-asaas-subscription`, `generate-audience-profile`, `generate-personalized-matrix`, `generate-daily-guide` precisam estar deployadas **lá**. Lovable não deploya pro self-hosted automático.

## Plano de ação

1. Leio `Auth.tsx`, `create-asaas-subscription/index.ts`, `Onboarding.tsx` (read-only)
2. Reporto: se o código tá ok, o que pode quebrar no self-hosted, e a checklist de validação no Studio self-hosted que **só você consegue rodar**
3. Sem mudanças de código (a menos que ache bug — aí indico no plano)

Após aprovação, executo a leitura e dou o veredito completo.
