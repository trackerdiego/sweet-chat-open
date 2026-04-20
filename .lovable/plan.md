
## Solução concreta

O problema deixou de ser “descobrir o que está acontecendo”. A base já é suficiente para fechar isso com uma correção objetiva em 4 frentes:

1. parar definitivamente qualquer fallback inválido/deploy ambíguo
2. reduzir a chance de `MALFORMED_FUNCTION_CALL` nas functions com schema pesado
3. dar mais tolerância a timeout/503 onde o modelo está respondendo, mas lento
4. impedir que o onboarding “minta” o progresso e pareça quebrado em cascata

## O que será implementado

### 1) Congelar a configuração real dos modelos nas 5 edge functions
Arquivos:
- `supabase/functions/generate-audience-profile/index.ts`
- `supabase/functions/generate-daily-guide/index.ts`
- `supabase/functions/generate-tools-content/index.ts`
- `supabase/functions/generate-personalized-matrix/index.ts`
- `supabase/functions/generate-script/index.ts`

Mudanças:
- manter só modelos `gemini-2.5-*`
- remover qualquer possibilidade de fallback para `gemini-1.5-flash` ou `gemini-2.0-flash`
- adicionar um log curto e explícito no início de cada request com:
  - function
  - `PRIMARY_MODEL`
  - `FALLBACK_MODEL`
  - timeout ativo

Resultado:
- os próximos logs deixam de ser ambíguos
- fica impossível continuar “caindo” em modelo deprecated sem perceber imediatamente

### 2) Corrigir de verdade o `daily-guide`, que hoje é o ponto mais frágil
Arquivo:
- `supabase/functions/generate-daily-guide/index.ts`

Mudança principal:
- dividir a geração em 2 chamadas menores, em vez de 1 tool call grande:
  - chamada A: `contentTypes`, `hooks`, `videoFormats`, `storytelling`, `ctas`, `cliffhangers`
  - chamada B: `taskExamples`

A resposta final continua igual para o frontend, mas o backend monta o objeto final unindo as duas partes.

Ajustes adicionais:
- simplificar o schema de `taskExamples`
- remover rigidez desnecessária (`additionalProperties: false`) onde ela só aumenta rejeição do Gemini
- manter `PRIMARY_MODEL = "gemini-2.5-pro"` e `FALLBACK_MODEL = "gemini-2.5-pro"`
- preservar timeout maior

Resultado:
- reduz drasticamente a chance de `function_call_filter: MALFORMED_FUNCTION_CALL`
- o Daily Guide deixa de depender de uma única resposta enorme e mais frágil

### 3) Endurecer `audience-profile` e `tools-content` sem reescrever tudo
Arquivos:
- `supabase/functions/generate-audience-profile/index.ts`
- `supabase/functions/generate-tools-content/index.ts`

#### `generate-audience-profile`
Mudanças:
- manter `2.5-pro`
- aliviar o schema do step 2:
  - remover `additionalProperties: false`
  - reduzir o conjunto de campos obrigatórios ao essencial
  - manter compatibilidade com o que o app já lê

Objetivo:
- diminuir timeout/rejeição na etapa visceral sem quebrar o formato salvo em `audience_profiles`

#### `generate-tools-content`
Mudanças:
- simplificar schemas por tool type
- achatar estruturas aninhadas onde possível
- no tipo `viral`, trocar `adaptedScript` aninhado por campos rasos (`scriptHook`, `scriptBody`, `scriptCta`) e remontar no backend se necessário para manter compatibilidade

Objetivo:
- sair do estado “às vezes funciona, às vezes MALFORMED”

### 4) Ajustar o onboarding para refletir o estado real
Arquivo:
- `src/pages/Onboarding.tsx`

Mudanças:
- remover o timer artificial que hoje marca “audience” como concluído antes da resposta real
- não pintar `audience` e `visceral` de erro simultaneamente por antecipação
- só avançar status quando a function realmente responder
- manter retry apenas onde faz sentido
- mensagens mais honestas:
  - erro na análise de público/estudo visceral
  - erro na matriz
  - finalização concluída

Resultado:
- o usuário deixa de ver uma sequência “vermelha” enganosa
- o problema passa a parecer exatamente do tamanho que ele tem

## Ordem de execução
1. corrigir `generate-daily-guide`
2. aliviar `generate-audience-profile` e `generate-tools-content`
3. reforçar logs/configuração nas 5 functions
4. corrigir `Onboarding.tsx`

## Arquivos que serão alterados
- `supabase/functions/generate-daily-guide/index.ts`
- `supabase/functions/generate-audience-profile/index.ts`
- `supabase/functions/generate-tools-content/index.ts`
- `supabase/functions/generate-personalized-matrix/index.ts`
- `supabase/functions/generate-script/index.ts`
- `src/pages/Onboarding.tsx`

## Critério de sucesso
- nenhum log novo com `gemini-1.5-flash` ou `gemini-2.0-flash`
- `daily-guide` sem `no tool_calls in response`
- `tools-content` estável, sem falha intermitente
- `audience-profile` com menos timeout na etapa 2
- onboarding concluindo sem efeito cascata enganoso

## Detalhes técnicos
```text
Causa raiz prática:
1. logs antigos + runtime confuso fizeram a investigação parecer circular
2. o maior bug atual não é mais “modelo deprecated”; é schema pesado demais para tool calling
3. o onboarding hoje amplifica a sensação de falha porque simula progresso antes da resposta real
```

```text
Estratégia adotada:
- não depender de “mais um retry”
- reduzir complexidade das respostas estruturadas
- manter compatibilidade com o frontend
- tornar os logs autoexplicativos
```
