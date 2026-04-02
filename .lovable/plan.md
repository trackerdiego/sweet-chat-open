
Objetivo

- Fazer os próximos emails de confirmação chegarem como “InfluLab” na caixa de entrada, em vez de “Supabase Auth”.

Diagnóstico

- O código já está preparado para branding: o remetente foi definido como `InfluLab <noreply@influlab.pro>`.
- O subdomínio de envio `notify.influlab.pro` está verificado.
- Mesmo assim, os logs atuais ainda mostram envio saindo por `noreply@mail.app.supabase.io`.
- Também não há sinais de que o fluxo customizado de auth esteja recebendo os eventos.
- Conclusão: o problema principal não é o template; é que o Auth ainda está usando o envio padrão, não o fluxo brandado da InfluLab.

Plano

1. Reativar o envio customizado dos emails de autenticação
- Reaplicar a configuração de email de autenticação do projeto para que signup, recuperação e magic link passem pelo fluxo brandado.
- Se a configuração estiver “desconectada”, refazer o vínculo preservando a marca InfluLab.

2. Garantir o remetente visível correto
- Manter o cabeçalho `from` como `InfluLab <noreply@influlab.pro>`.
- Confirmar que o domínio real de envio continue sendo `notify.influlab.pro`, que já está validado.

3. Verificar o estado do envio do projeto
- Confirmar que o envio customizado do projeto está habilitado.
- Validar que a fila/processamento de emails esteja pronta para enviar assim que o fluxo de auth voltar a receber eventos.

4. Validar com um novo email de confirmação
- Disparar um novo cadastro/teste.
- Confirmar dois sinais de sucesso:
  - o log deixa de mostrar `mail.app.supabase.io`;
  - passam a aparecer registros no log interno de emails do projeto.

Resultado esperado

- Novos emails chegam com remetente “InfluLab”.
- O conteúdo continua com branding da InfluLab.
- Emails antigos já recebidos não mudam; a correção vale para os próximos envios.

Detalhes técnicos

- Hoje o projeto já tem quase tudo pronto: domínio verificado, templates customizados e remetente definido no código.
- O ponto que falta é fazer o Auth realmente usar esse fluxo customizado.
- Se eu encontrar divergência entre o domínio do app e a URL usada nos links dos emails, também alinharei isso para evitar novo comportamento incorreto no clique do usuário.
