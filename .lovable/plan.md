Status do que já está feito:

1. Frontend da tela /auth
- Já está implementada a validação antes do envio: o app tenta detectar se o email existe antes de chamar o reset de senha.
- Se o email não existir, deveria aparecer uma mensagem dizendo que a conta não foi encontrada e oferecendo “Criar conta”.
- Isso só vale onde o frontend novo estiver publicado. Se você testou em app.vyrallab.online e o deploy da Vercel ainda não pegou a alteração, vai continuar com o comportamento antigo.

2. Template novo do email
- O arquivo novo `recovery.html` já foi gerado e está disponível.
- Ele ainda não altera automaticamente o Supabase self-hosted. Para mudar o email real, você precisa subir esse HTML no Storage self-hosted, substituindo o arquivo atual em `emails/emails/recovery.html`.
- Sem esse upload manual, o email continuará chegando com o template antigo.

3. O que ainda pode estar falhando
- O email pode não chegar por problema no Auth/SMTP/template path no self-hosted.
- A validação de email pode não aparecer se você estiver testando no domínio publicado antes do deploy novo.
- O reset pode estar sendo chamado, mas o email pode estar indo para spam ou usando ainda o template antigo.

Plano para fechar o diagnóstico:

1. Confirmar onde você testou
- Verificar se foi no preview da Lovable ou no domínio `https://app.vyrallab.online`.
- Se foi no domínio publicado, confirmar se a Vercel já recebeu a alteração do arquivo `src/pages/Auth.tsx`.

2. Confirmar se o frontend novo está em produção
- Testar a recuperação com um email inexistente.
- Resultado esperado: aparecer mensagem “Não encontramos uma conta com este email...” e botão “Criar conta”.
- Se aparecer mensagem genérica de envio, o domínio ainda está com frontend antigo.

3. Confirmar se o Supabase self-hosted enviou o email
Rodar no VPS, em `~/supabase/docker`:

```bash
docker compose logs --tail=200 auth | grep -Ei "recover|mailer|smtp|error|template|mentecomp|request completed"
```

4. Confirmar se o usuário existe no Auth self-hosted
Trocar pelo email testado:

```bash
docker compose exec db psql -U postgres -d postgres -c "SELECT email, email_confirmed_at, created_at FROM auth.users WHERE lower(email) = lower('EMAIL_TESTADO');"
```

5. Subir o template novo no Storage self-hosted
- Baixar o arquivo `recovery.html` gerado.
- No Studio self-hosted, abrir Storage → bucket `emails` → pasta `emails/`.
- Substituir o arquivo `recovery.html` atual.
- Testar recuperação novamente.

6. Se o email ainda não chegar
- Revisar logs do container `auth` imediatamente após o teste.
- Se o log mostrar status 200 em `/recover`, o Auth aceitou o pedido; o problema passa a ser SMTP/template/destino.
- Se mostrar erro SMTP/template, corrigimos a variável ou o arquivo específico no self-hosted.