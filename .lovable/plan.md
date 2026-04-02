

# Ativar Emails Brandados da InfluLab

## Situação Atual
- O domínio `notify.influlab.pro` está **verificado** e pronto para envio
- Os templates de email já existem no código, mas precisam ser re-scaffoldados pela ferramenta oficial do Lovable para ativar o fluxo correto (enfileiramento via pgmq)
- Após isso, os emails de autenticação (confirmação de cadastro, recuperação de senha, etc.) passarão a chegar com remetente "InfluLab" em vez de "Supabase Auth"

## Plano

### 1. Re-scaffoldar os templates de auth email
- Usar a ferramenta de scaffolding para gerar os templates compatíveis com o sistema de fila do Lovable
- Isso garante que o `auth-email-hook` use o fluxo correto (enqueue via pgmq) em vez do envio direto

### 2. Aplicar branding da InfluLab nos templates
- Extrair cores e estilos do projeto (CSS variables, logo)
- Aplicar nos 6 templates: signup, recovery, magic-link, invite, email-change, reauthentication
- Textos em PT-BR, tom consistente com o app
- Upload do logo para storage bucket para uso nos emails

### 3. Deploy do auth-email-hook
- Fazer deploy da edge function atualizada

### 4. Confirmar ativação
- Os emails passarão a sair de `noreply@notify.influlab.pro` com visual da InfluLab
- O nome do remetente na caixa de entrada será "InfluLab" (não mais "Supabase Auth")

## Resultado Esperado
- Remetente aparece como **InfluLab** na caixa de entrada
- Email com logo, cores e textos em português
- Links de confirmação apontam para `https://influlab.pro`

