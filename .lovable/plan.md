

# Melhorar o Onboarding para garantir descrições mais completas

## Problema
Usuários estão preenchendo descrições rasas ou pulando o campo, resultando em nichos genéricos ("lifestyle") e conteúdo de IA pouco personalizado.

## Alterações em `src/pages/Onboarding.tsx`

### 1. Aumentar mínimo de caracteres de 30 para 80
- Garante que o usuário escreva pelo menos 2 frases úteis
- Atualizar a validação em `canAdvance()` e o contador visual

### 2. Reescrever textos do step 1 (descrição) para serem mais persuasivos
- Título: "Quanto mais você descrever, melhor será sua experiência"
- Subtítulo explicando que a IA usa isso para criar o estudo de público, matriz e roteiros
- Placeholder mais detalhado com exemplo real completo

### 3. Adicionar dicas colapsáveis abaixo do textarea
- Pequeno bloco com "💡 Dicas para uma descrição poderosa:" listando 3-4 perguntas guia:
  - Qual seu nicho principal?
  - Quem é seu público-alvo?
  - Qual seu objetivo com o conteúdo?
  - Que tipo de resultado você quer gerar?

### 4. Feedback visual progressivo no contador
- Verde a partir de 80 chars (mínimo)
- Amarelo entre 50-79 (quase lá)
- Cinza abaixo de 50

## Resultado
- Descrições mais ricas → estudo de público mais profundo → experiência melhor desde o primeiro dia
- Nenhuma mudança de banco de dados necessária

