

# Ativar Emails Personalizados com sua Brand

## Situacao Atual

Os templates de email ja existem no projeto com a brand do InfluLab (cores roxas, fonte Inter, textos em portugues). O dominio `notify.influlab.pro` esta verificado. O que falta e **deployar a Edge Function** `auth-email-hook` para que o Supabase use seus templates customizados em vez dos emails padrao.

## O que ja esta pronto
- 6 templates branded: signup, recovery, magic-link, invite, email-change, reauthentication
- Cores da brand aplicadas (roxo `hsl(258, 60%, 55%)`, fonte Inter)
- Textos em portugues
- Dominio verificado (`notify.influlab.pro`)
- Emails habilitados no projeto

## Plano

### Passo unico: Deploy da Edge Function `auth-email-hook`

Deployar a funcao para que os emails passem a usar seus templates customizados, enviados de `noreply@influlab.pro`.

Apos o deploy, todos os emails de autenticacao (confirmacao de cadastro, recuperacao de senha, magic link, etc.) serao enviados com a sua brand.

