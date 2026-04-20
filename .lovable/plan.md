
Corrigir a falha de geração com IA em Tarefas, onde `generate-daily-guide` está retornando `500` após ~21s, e deixar o fluxo robusto no backend self-hosted sem perder a regra do produto de manter 5 exemplos práticos por tarefa.

## Diagnóstico provável

Pelo código atual e pelos screenshots, o erro não parece ser:
- autenticação (`401`)
- limite gratuito (`429`)
- timeout tratado (`504`)

O `500` mais provável vem de uma exceção interna depois da resposta da IA, principalmente em um destes pontos:
1. `tool_calls` não veio no formato esperado
2. `toolCall.function.arguments` veio vazio/inválido
3. `JSON.parse(...)` falhou
4. a function consumiu quota antes de concluir e depois quebrou
5. o front está escondendo o erro real com toast genérico

## O que será ajustado

### 1. Endurecer o parser da resposta da IA em `generate-daily-guide`
Arquivo: `supabase/functions/generate-daily-guide/index.ts`

- Adicionar logs estruturados antes e depois da chamada à IA:
  - `userId`
  - `day`
  - `pillar`
  - latência
  - status HTTP da Gemini
- Logar o shape da resposta quando `tool_calls` não vier.
- Envolver o parse em tratamento explícito:
  - se não vier `tool_calls`, registrar payload resumido e retornar erro claro
  - se `JSON.parse` falhar, retornar erro claro
- Manter timeout/retry já existente, mas separar melhor:
  - erro de gateway/timeout
  - erro de formato da resposta
  - erro interno da function

### 2. Não cobrar tentativa que falhou
Arquivos:
- `supabase/functions/generate-daily-guide/index.ts`
- `supabase/functions/generate-tools-content/index.ts`

Hoje a contagem de uso é incrementada antes do sucesso real. Vou mover o update de `user_usage` e o insert em `usage_logs` para depois do parse válido da resposta da IA.

Isso evita:
- gastar quota quando a IA falha
- mascarar diagnósticos
- gerar frustração no usuário

### 3. Preservar a regra de negócio dos 5 exemplos por tarefa
Memória do projeto exige exatamente 5 exemplos práticos por tarefa personalizados por IA.

Então não vou consolidar a redução para 3 exemplos. Em vez disso, a correção seguirá este caminho:
- manter 5 exemplos
- otimizar prompt e validação
- tornar `taskExamples` resiliente sem quebrar o restante da resposta
- se necessário, aceitar fallback parcial: categorias principais aparecem mesmo se algum bloco opcional falhar, sem derrubar a geração inteira

### 4. Melhorar o contrato de erro da edge function
Arquivo: `supabase/functions/generate-daily-guide/index.ts`

Padronizar respostas JSON com mensagens específicas, por exemplo:
- `Não autorizado`
- `Limite gratuito atingido`
- `Rate limit exceeded`
- `A IA retornou resposta sem dados estruturados`
- `A IA retornou JSON inválido`
- `A IA está demorando mais que o normal`

Isso facilita o front interpretar corretamente.

### 5. Melhorar feedback no frontend
Arquivo: `src/components/DailyGuide.tsx`

- Fazer `console.error` completo do objeto retornado por `supabase.functions.invoke(...)`
- Diferenciar toasts por status:
  - `401` sessão expirada
  - `402` créditos esgotados
  - `429` limite/requisições
  - `504` timeout
  - `500` mostrar mensagem retornada pelo backend quando existir
- Evitar toast genérico quando o backend já explicou o problema

### 6. Aplicar a mesma correção estrutural em `generate-tools-content`
Arquivo: `supabase/functions/generate-tools-content/index.ts`

Mesmo problema potencial existe lá:
- parse rígido de `tool_calls`
- consumo de quota antes do sucesso
- pouca observabilidade

Vou alinhar o comportamento com `generate-daily-guide` para não repetir o bug em Ferramentas.

## Resultado esperado

Após a implementação:
- Tarefas deixa de falhar silenciosamente com `500` genérico
- falhas passam a indicar causa real
- tentativas com erro não consomem uso diário
- o backend self-hosted fica mais fácil de diagnosticar
- a regra de 5 exemplos por tarefa continua preservada

## Arquivos afetados

- `supabase/functions/generate-daily-guide/index.ts`
- `supabase/functions/generate-tools-content/index.ts`
- `src/components/DailyGuide.tsx`

## Validação

1. Fazer login com usuário de teste
2. Ir em `Tarefas` e clicar em “Gerar sugestões com IA”
3. Confirmar:
   - sucesso com conteúdo renderizado
   - ou erro específico, não genérico
4. Confirmar que falha não incrementa `tool_generations`
5. Em caso de nova falha, usar os logs estruturados do container para identificar o ponto exato

## Deploy no self-hosted

Como o backend real é `api.influlab.pro`, depois da implementação será necessário reiniciar as functions no servidor:

```bash
cd ~/supabase/docker
docker compose restart functions
```
