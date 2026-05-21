Diagnóstico atual:
- A função self-hosted `https://api.influlab.pro/functions/v1/start-hype-job` está alcançável e carrega sem SyntaxError, porque respondeu `401 Não autorizado` quando testada sem token válido. Então o erro anterior de duplicidade provavelmente não é mais o único problema.
- O preview que consegui abrir está na landing page sem login, então não disparou a chamada real do Hype.
- Encontrei um bug real no frontend: depois da primeira tentativa, `useDailyHype` marca `startedRef.current = true`; ao clicar em atualizar de novo, ele não dispara novo job. Ou seja: se a primeira tentativa falha, o botão pode ficar preso sem tentar gerar de verdade.
- As consultas via ferramenta Supabase não provam o estado real do app, porque o app usa Supabase self-hosted em `api.influlab.pro`, e as migrations Lovable não alteram esse banco automaticamente.

Plano de correção:

1. Corrigir o botão de tentar novamente
- Alterar `src/hooks/useDailyHype.ts` para separar carregamento inicial de recarregamento manual.
- No reload manual, limpar erro, zerar `startedRef`, e disparar um novo `start-hype-job` mesmo que já tenha tentado antes.
- Garantir que múltiplos cliques não criem jobs paralelos enquanto já estiver processando.

2. Blindar o backend do Hype contra falhas parciais
- Em `supabase/functions/start-hype-job/index.ts`, tratar falhas de leitura/gravação de `daily_hype_raw` como degradadas, não como erro fatal.
- Se coleta de tendências ou upsert falhar, seguir para modo evergreen via Gemini, em vez de devolver erro para o usuário.
- Se o Gemini devolver lista vazia, retornar uma mensagem clara e persistir falha amigável no `ai_jobs`, em vez de mostrar “sem tendências”.

3. Melhorar visibilidade do erro
- Fazer o frontend exibir mensagem mais útil quando o job falhar, diferenciando:
  - falha ao iniciar job;
  - falha no polling;
  - job finalizado sem itens.
- Manter o texto simples para o usuário, mas preservar logs técnicos no console/função.

4. Entregar checklist para o self-hosted
- Como o backend real é self-hosted, entregar junto o SQL de verificação/criação das tabelas `daily_hype_raw` e `user_daily_hype` para rodar no Studio do self-hosted se ainda não existir.
- Entregar o bloco de deploy da VPS para publicar a função atualizada.

Resultado esperado:
- Clicar em “Hype do dia”/atualizar realmente tenta gerar de novo.
- Se Google/YouTube/Reddit falharem, o usuário ainda recebe 5 pautas evergreen.
- O card não fica preso em “sem tendências” por causa de uma tentativa anterior falhada.