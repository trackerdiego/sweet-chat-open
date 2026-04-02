

# Trocar domínio de email para influlab.pro (verificado)

## Situacao Atual
- `app.influlab.pro` esta pendente de verificacao DNS (pode levar ate 72h)
- `influlab.pro` ja esta **verificado** e pronto para uso
- Enquanto o DNS nao verifica, os emails continuam saindo como "Supabase Auth"

## Plano

### 1. Re-scaffoldar os templates com o dominio verificado
- Usar a ferramenta de scaffolding com overwrite para gerar os templates apontando para `influlab.pro`
- Isso atualiza o `SENDER_DOMAIN` para `notify.influlab.pro` (verificado)

### 2. Reaplicar branding da InfluLab
- Manter os textos em PT-BR, cores e estilos que ja existem nos templates
- Ajustar `SENDER_DOMAIN`, `ROOT_DOMAIN` e `FROM_DOMAIN` para `influlab.pro`

### 3. Deploy do auth-email-hook
- Fazer deploy da edge function atualizada

## Resultado Esperado
- Emails passam a sair de `noreply@notify.influlab.pro` (dominio verificado)
- Remetente aparece como **InfluLab** na caixa de entrada
- Funciona imediatamente, sem esperar DNS

