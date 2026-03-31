

# Corrigir Experiência de Email de Confirmação

## Problemas Identificados

1. **Email chega com branding do Supabase** — O `auth-email-hook` existe no código mas pode não estar deployado/ativado, então o Supabase envia o email padrão dele em vez do template customizado do InfluLab.

2. **Link de verificação leva a página de erro** — O `signUp()` em `Auth.tsx` não define `emailRedirectTo`, então o Supabase redireciona para a URL padrão configurada no projeto (provavelmente uma URL antiga/incorreta). Além disso, o app não tem um handler para processar o token de confirmação na URL.

## Solução

### 1. Deploy do auth-email-hook
- Fazer deploy da edge function `auth-email-hook` para que os emails customizados com branding InfluLab sejam efetivamente usados
- Os templates já existem e estão com visual correto (cores roxas, logo InfluLab, textos em português)

### 2. Corrigir redirect do signUp
- Adicionar `emailRedirectTo: window.location.origin` no `signUp()` em `Auth.tsx` para que o link de confirmação redirecione para o app correto

### 3. Adicionar handler de confirmação no App
- Atualizar `useUserProfile.ts` para tratar o evento `SIGNED_IN` que vem após clicar no link de confirmação — o `onAuthStateChange` já existe, mas precisamos garantir que o fluxo de redirect funcione suavemente após confirmação

### 4. Atualizar subjects dos emails para português
- Alterar os subjects em `auth-email-hook/index.ts` de inglês para português:
  - "Confirm your email" → "Confirme seu email - InfluLab"
  - "Reset your password" → "Redefinir sua senha - InfluLab"
  - "Your login link" → "Seu link de acesso - InfluLab"
  - etc.

## Arquivos alterados

1. `src/pages/Auth.tsx` — adicionar `emailRedirectTo`
2. `supabase/functions/auth-email-hook/index.ts` — traduzir subjects para PT-BR
3. Deploy da edge function `auth-email-hook`

