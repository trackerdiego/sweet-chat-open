

# Corrigir Emails de Autenticação — Branding + Redirecionamento

## Problemas

1. **Email chega com branding do Supabase** — O auth-email-hook existe no código mas não está ativado/deployado. O Supabase está enviando o email padrão ("Confirm Your Signup" em inglês, sem marca InfluLab).

2. **Link de confirmação aponta para localhost:3000** — O `emailRedirectTo: window.location.origin` resolve para `localhost:3000` no ambiente de preview/dev. Precisa apontar para a URL real do app publicado.

## Correções

### 1. Deploy do auth-email-hook
O edge function precisa ser deployado para que o Supabase passe a usar os templates customizados com branding InfluLab. Após o deploy, a ativação acontece automaticamente via Cloud → Emails.

### 2. Corrigir URL de redirecionamento em `src/pages/Auth.tsx`
Trocar `window.location.origin` por uma URL fixa do app publicado, ou usar uma lógica que priorize a URL de produção.

**Alteração em `src/pages/Auth.tsx`:**
- No `signUp` (linha 51): trocar `emailRedirectTo: window.location.origin` para usar a URL publicada do app
- No `resetPasswordForEmail` (linha 27): mesmo ajuste no `redirectTo`

A URL correta seria `https://influlab.pro` (domínio custom) ou `https://sweet-chat-open.lovable.app` (URL publicada). Como o projeto usa o domínio `influlab.pro`, usaremos esse.

### 3. Re-deploy do auth-email-hook
Deploy da edge function para ativar os templates brandados que já existem no código.

## Resultado Esperado
- Emails chegam com visual InfluLab (logo, cores, texto em PT-BR)
- Link de confirmação redireciona para `https://influlab.pro` (ou a URL publicada), não mais para localhost

