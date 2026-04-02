
Objetivo

- Resolver por que os emails ainda chegam como “Supabase Auth” e esclarecer se falta alguma ação manual.

Diagnóstico

- O problema não está no `signUp()`:
  - o cadastro já usa `emailRedirectTo: 'https://influlab.pro'`
  - a recuperação já usa `redirectTo: 'https://influlab.pro/reset-password'`
- O email de confirmação bem-sucedido mais recente saiu do fluxo padrão do Supabase:
  - `mail_from = noreply@mail.app.supabase.io`
- O fluxo customizado não está entrando:
  - não há logs de execução do `auth-email-hook`
  - `email_send_log` está vazio
- Há um desencontro de configuração:
  - o projeto ainda aparece vinculado ao domínio de email `app.influlab.pro`
  - o código do hook está configurado para `notify.influlab.pro` / `influlab.pro`
- Os últimos testes também estão batendo em limite de envio:
  - `429 over_email_send_rate_limit`

O que isso responde

- Não parece que o primeiro ajuste seja manual dentro do Supabase Auth.
- O problema persiste porque o fluxo brandado não está ativo de verdade no projeto: o envio continua caindo no remetente padrão, o hook não executa e os testes recentes ainda estão poluídos por rate limit.
- Se houver um passo manual, ele é mais provavelmente no gerenciamento de email do projeto para alinhar o domínio ativo, não no formulário de signup nem no redirect.

Plano

1. Alinhar o domínio de email ativo do projeto
   - Confirmar o domínio que o projeto vai usar de fato.
   - Trocar o domínio ativo do projeto para o mesmo domínio usado no hook.
   - Garantir que os emails do projeto estejam habilitados.

2. Reconciliar o fluxo de auth email
   - Regerar/reativar os templates de autenticação sobre o domínio ativo correto.
   - Publicar novamente o hook para garantir que o Auth passe pela fila personalizada.

3. Validar com teste limpo
   - Esperar a janela do rate limit esfriar.
   - Fazer apenas 1 teste de signup.
   - Confirmar 3 sinais:
     - aparece execução do `auth-email-hook`
     - aparece registro em `email_send_log`
     - não aparece novo envio via `mail.app.supabase.io`

4. Só se ainda falhar depois disso
   - Aí sim revisar a configuração do Auth no painel do Supabase como diagnóstico de exceção, porque hoje a evidência principal é que o hook nem está sendo acionado.

Detalhes técnicos

- Evidência de envio padrão: `noreply@mail.app.supabase.io`
- Evidência de hook inativo: sem logs em `auth-email-hook`
- Evidência de fila inativa: `email_send_log` vazio
- Divergência atual: domínio ativo do projeto = `app.influlab.pro`; código do hook = `notify.influlab.pro` / `influlab.pro`
- Ruído atual de teste: múltiplos `429` de rate limit no `/signup`
