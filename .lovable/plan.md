
# Produção sem confirmação por e-mail

## Direção recomendada
Parar de depender do e-mail de confirmação no cadastro e colocar o app em um modo mais simples:
- cadastro entra direto
- onboarding continua normal
- recuperação de senha continua por e-mail

Isso é mais seguro do que “desativar todos os e-mails”, porque mantém o fluxo de recuperação.

## O que precisa ser feito manualmente
Sim: há 1 ajuste manual no Supabase.
- Ir em **Authentication → Providers → Email**
- Desativar a exigência de **confirmar e-mail** no cadastro

Efeito prático:
- o usuário cria a conta e já fica autenticado
- nenhum e-mail de confirmação é enviado no signup

## Ajustes no app
### 1. Corrigir o fluxo de signup em `src/pages/Auth.tsx`
Hoje o código sempre assume que o usuário precisa confirmar o e-mail e mostra a tela `showConfirmation`.

Ajuste planejado:
- após `signUp`, verificar o retorno real do Supabase
- se vier `session`, considerar cadastro concluído e redirecionar direto
- só mostrar “Verifique seu email” quando não houver sessão

### 2. Redirecionar corretamente após cadastro
Como as rotas já tratam usuário autenticado e levam para onboarding/home, o app pode:
- mostrar um toast de sucesso
- navegar para `/onboarding` ou deixar o roteamento automático assumir

### 3. Parar de usar URLs fixas de redirect
Hoje há URLs hardcoded para `influlab.pro`, o que é frágil.

Ajuste planejado:
- signup: usar `window.location.origin`
- reset de senha: usar `${window.location.origin}/reset-password`

Isso deixa preview, domínio publicado e produção consistentes.

### 4. Ajustar a copy da interface
Se a confirmação de e-mail sair do fluxo:
- remover a expectativa de “enviamos um link de confirmação” como comportamento padrão do cadastro
- manter “Esqueci minha senha” ativo

## Se você quiser reduzir ainda mais a dependência de e-mail
Há uma alternativa de contingência:
- desligar a confirmação de e-mail no cadastro
- manter apenas recuperação de senha por e-mail
- se os e-mails customizados continuarem instáveis, voltar temporariamente ao fluxo padrão de recuperação, sem branding customizado

Eu não recomendo “sem nenhum e-mail” em produção, a menos que você também aceite:
- esconder/remover “Esqueci minha senha”
- não depender de troca de e-mail/reauthentication por e-mail

## Resultado esperado
- cadastro funciona em produção sem travar no e-mail
- usuário entra imediatamente após criar a conta
- onboarding continua funcional
- recuperação de senha segue disponível
- o problema dos e-mails deixa de bloquear o crescimento do app

## Detalhes técnicos
- Não precisa mudança de banco para isso
- O roteamento atual já suporta login imediato após signup
- O principal ajuste de código é em `Auth.tsx`, porque hoje o frontend sempre assume confirmação obrigatória
- `ResetPassword.tsx` continua útil e deve ser mantido
- O ponto mais importante para produção é desligar a confirmação no painel e alinhar o frontend a esse comportamento
