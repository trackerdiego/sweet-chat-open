## Tarefa
Adicionar um comentário de advertência forte no topo de `src/integrations/supabase/client.ts` para que ninguém (nem ferramentas automáticas do Lovable) reverta os valores hardcoded para variáveis de ambiente `VITE_SUPABASE_*`.

## Por que
O projeto usa backend **self-hosted** (`api.influlab.pro`). O `.env` gerado automaticamente pelo Lovable aponta para Supabase Cloud, que pode ficar pausado e gerar `invalid apikey`. Os valores já foram hardcoded no arquivo; o comentário evita regressão futura.

## Implementação
- Adicionar comentário de bloco no topo de `src/integrations/supabase/client.ts` explicando:
  - Que o app usa backend self-hosted
  - Que `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env` são do projeto Cloud e NÃO devem ser usados
  - Que qualquer alteração para ler dessas variáveis vai quebrar o login de todos os usuários

Nenhuma outra mudança de código, backend ou SQL necessária.