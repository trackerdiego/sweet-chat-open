# Consultor IA: responder a pergunta, não o nicho

## Problema
Hoje o `supabase/functions/ai-chat/index.ts` injeta nicho, avatar e estudo visceral no system prompt e ainda manda: *"Use TODO esse contexto em cada resposta"*. Resultado: usuário do nicho "digital" pergunta sobre vender bolsas e a IA força tudo de volta pro digital.

## Mudança (apenas no system prompt da function)

1. **Tirar a ordem absoluta** `"Use TODO esse contexto em cada resposta"`.
2. **Reposicionar o contexto como opcional**: rotular o bloco como *"Contexto do criador (use SOMENTE se a pergunta for sobre o conteúdo/nicho/audiência dele)"*.
3. **Adicionar regra de prioridade**:
   - Se a pergunta for sobre outro nicho, produto, tema ou dúvida genérica → responder exatamente sobre o que foi perguntado, ignorando nicho/avatar salvos.
   - Só aplicar nicho/avatar quando o usuário pedir explicitamente algo sobre o conteúdo dele ou quando a pergunta for ambígua e claramente ligada à criação de conteúdo do nicho dele.
   - Nunca redirecionar a resposta para o nicho salvo nem dizer "como sua audiência é X…" quando o tema da pergunta não tem relação.
4. Manter todo o resto: estilo neutro de gênero, formato markdown, limite de 400 palavras, contagem de mensagens, limites free/premium, streaming.

## Arquivos
- `supabase/functions/ai-chat/index.ts` — só o trecho do `systemPrompt` (linhas ~150-180).

## Fora do escopo
- Frontend (`AiChat.tsx`) não muda.
- Sem mudança de schema, limites, modelo ou fluxo de streaming.

## Deploy
Edge function. Após merge, rodar na VPS:

```bash
cd /root/app && git pull && ./scripts/deploy-selfhost.sh ai-chat
```

## Verificação
- Perguntar "como vender bolsas femininas?" com nicho="digital" no perfil → resposta sobre bolsas, sem mencionar digital/avatar.
- Perguntar "me dê 3 ideias de reels pro meu nicho" → resposta usa nicho/avatar normalmente.
