

# Armazenar Token do Webhook e Adicionar Validação

## O que será feito

1. **Armazenar o secret `ASAAS_WEBHOOK_TOKEN`** no Supabase com o valor fornecido
2. **Atualizar `supabase/functions/asaas-webhook/index.ts`** para validar o token recebido no header `asaas-access-token` contra o secret armazenado — rejeitando requisições que não venham do Asaas

## Detalhes técnicos

O Asaas envia um header `asaas-access-token` com o token configurado no painel. A edge function irá:
- Ler `ASAAS_WEBHOOK_TOKEN` do ambiente
- Comparar com o header da requisição
- Retornar 401 se não bater

## Arquivos alterados

1. Secret `ASAAS_WEBHOOK_TOKEN` — novo
2. `supabase/functions/asaas-webhook/index.ts` — adicionar validação do token

