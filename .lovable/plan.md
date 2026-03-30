

# Checklist Detalhado + Retry na Geração de Público

## Problema

1. O pipeline mostra 3 passos, mas `generate-audience-profile` faz **2 chamadas AI sequenciais** internamente (descrição + perfil visceral) — o usuario não vê progresso granular
2. O passo 3 (matriz 30 dias) falha às vezes (429 rate limit ou timeout) e **não tem retry**
3. A progress bar pula de 10% para 55% de uma vez — parece travado

## Plano

### 1. Separar o pipeline em 4 passos visuais

**Arquivo:** `src/pages/Onboarding.tsx`

Alterar `pipelineSteps` de 3 para 4:
- Passo 1: "Analisando seu nicho e público" (step 1 da edge function)
- Passo 2: "Estudo visceral — medos, desejos, gatilhos" (step 2 da edge function)
- Passo 3: "Criando sua Matriz de 30 dias" (matrix)
- Passo 4: "Finalizando seu perfil" (onboarding_completed)

Para isso, a edge function `generate-audience-profile` precisa retornar um indicador de progresso entre os 2 passos. Como ela já retorna `audienceDescription` e `avatarProfile`, o frontend pode:
- Marcar passo 1 como "done" quando a função retorna (ambos já vêm juntos)
- Ou: separar em 2 chamadas distintas

**Abordagem escolhida:** Manter a edge function como está (ela retorna tudo junto), mas no frontend simular o progresso intermediário com um timer que marca o passo 1 após ~15s, já que o step 1 da AI é mais rápido. Quando a função retorna, marca ambos como done.

### 2. Adicionar retry automático para a matriz

**Arquivo:** `src/pages/Onboarding.tsx`

Na chamada `generate-personalized-matrix`:
- Se falhar, aguardar 3 segundos e tentar novamente (1 retry)
- Se falhar no retry, mostrar botão "Tentar novamente" em vez de apenas avançar com warning

### 3. Atualizar progress bar com intervalos mais suaves

Usar `setInterval` durante cada passo ativo para incrementar a progress bar gradualmente (ex: +1% a cada 2s), dando sensação de progresso contínuo em vez de saltos abruptos.

### Arquivos alterados

1. `src/pages/Onboarding.tsx` — pipeline de 4 passos, retry na matriz, progress suave

