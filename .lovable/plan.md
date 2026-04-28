Entendo totalmente a frustração. E sua leitura faz sentido: o chat parece “mágico” porque ele usa um caminho muito mais leve e estável; as outras tools estão fazendo chamadas mais pesadas, estruturadas em JSON, algumas em paralelo e muitas começando pelo `gemini-2.5-pro`, que é justamente o modelo mais sujeito a congestionamento/overload.

## Causa provável

Hoje existem dois perfis bem diferentes:

```text
Chat IA
- streaming
- gemini-2.5-flash
- resposta em texto livre
- prompt menor
- 1 chamada simples

Tools / Scripts / Guia / Onboarding
- generateContent estruturado
- muitas usam gemini-2.5-pro primeiro
- responseSchema / JSON obrigatório
- prompts longos
- algumas fazem 2 chamadas paralelas
- falhas de JSON ou overload viram erro final
```

Então não é “Supabase auto-hospedado é incapaz”. É que no self-hosted nós estamos chamando o Google direto, sem a camada de resiliência/balanceamento que existe no ambiente Lovable Cloud/AI Gateway. O chat funciona porque, por acaso, já está no perfil mais seguro: `flash + streaming + texto`.

## Plano de correção definitivo

### 1. Mudar a estratégia padrão das tools para “flash-first”

Para ferramentas de uso diário, script, guia e transcrição, usar:

```text
gemini-2.5-flash → gemini-2.5-flash-lite → gemini-2.5-pro somente se necessário
```

Em vez de começar pelo `pro`.

Motivo: essas funções não precisam do `pro` na maioria dos casos. O `flash` é exatamente o que já está funcionando bem no chat e tende a ser mais estável/rápido.

### 2. Reservar `gemini-2.5-pro` só para tarefas realmente profundas

Manter ou usar `pro` apenas onde ele faz diferença real:

- análise visceral/onboarding profundo
- matriz estratégica completa
- raciocínios longos e complexos

Para geração de hooks, scripts, guias e transcrição, priorizar estabilidade.

### 3. Padronizar todas as funções no helper resiliente

Hoje `start-transcription-job` ainda chama o endpoint Gemini direto, fora do helper `_shared/gemini.ts`.

Vou colocar transcrição também no mesmo padrão resiliente:

- timeout controlado
- retry
- fallback de modelo
- logs estruturados
- `attempts` / `model_used` quando possível

### 4. Corrigir observabilidade de falhas

A tabela já tem `attempts` e `model_used`, mas os jobs que falham ainda aparecem com `NULL` porque o metadata só é salvo no sucesso.

Vou ajustar para persistir, também em falhas:

- quantas tentativas foram feitas
- último modelo tentado
- status HTTP/erro upstream resumido

Assim a tela SQL deixa claro se falhou no `pro`, no `flash`, no fallback, ou se foi erro de JSON/schema.

### 5. Reduzir falhas por JSON inválido

Adicionar uma camada de recuperação quando o Gemini retorna texto quase-JSON:

- parser mais tolerante
- se JSON estruturado vier inválido, fazer uma tentativa curta de “repair JSON” no `flash-lite`
- se ainda falhar, retornar mensagem específica: “IA respondeu em formato inválido”, não “Google instável”

Isso evita misturar overload real com erro de formatação.

### 6. Evitar chamadas paralelas desnecessárias no guia diário

O guia diário hoje pode fazer duas chamadas ao Gemini quase juntas. Em self-hosted isso aumenta chance de 429/503.

Vou serializar ou escalonar melhor:

```text
Parte A obrigatória → Parte B opcional com fallback local se falhar
```

Ou seja: se exemplos extras falharem, o guia principal ainda entrega conteúdo em vez de abortar a experiência inteira.

### 7. Melhorar a mensagem para o usuário final

Trocar a mensagem genérica “Google instável” por mensagens mais úteis:

- overload temporário real
- resposta inválida da IA
- limite/rate limit
- timeout
- falha parcial com conteúdo recuperado

Sem mascarar erro, mas também sem desanimar com uma mensagem única para tudo.

## Arquivos que serão ajustados

- `supabase/functions/_shared/gemini.ts`
- `supabase/functions/_shared/ai-job-runner.ts`
- `supabase/functions/start-script-job/index.ts`
- `supabase/functions/start-tools-job/index.ts`
- `supabase/functions/start-daily-guide-job/index.ts`
- `supabase/functions/start-transcription-job/index.ts`
- possivelmente funções legadas `generate-*` ainda usadas em algum fluxo

## Deploy necessário depois

Como o backend é Supabase self-hosted, depois da alteração será necessário subir as functions na VPS:

```bash
cd /root/app && git pull origin main
./scripts/deploy-selfhost.sh start-script-job start-tools-job start-daily-guide-job start-transcription-job get-ai-job-status
```

E, se mexermos no helper compartilhado, redeployar todas as functions que importam `_shared/gemini.ts`.

## Resultado esperado

- Chat continua funcionando como hoje.
- Tools deixam de depender primeiro do modelo mais instável.
- Falhas por overload reduzem bastante.
- Quando falhar, o diagnóstico fica claro no banco/logs.
- Guia diário e tools passam a degradar melhor em vez de simplesmente morrer.
- O comportamento fica muito mais parecido com a robustez percebida no Lovable Cloud.