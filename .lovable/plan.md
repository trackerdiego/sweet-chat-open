

# Varredura Completa do Projeto

## Resultado da Analise

### A logica de analise de publico (generate-audience-profile) esta CORRETA
O codigo esta identico ao Aura OS original, com os dois passos completos:
- Step 1: Descricao rica do publico-alvo via Gemini
- Step 2: Perfil visceral completo do avatar com tool calling (save_avatar_profile) contendo todos os campos: coreWounds, sevenSinsCurrent/Future, shameTriggers, verbalTriggers, deepOccultDesire, etc.

### PROBLEMA CRITICO: 6 Edge Functions tem codigo ERRADO
Durante a migracao anterior, 6 functions foram criadas com o codigo duplicado de `generate-audience-profile` em vez do codigo correto. Sao elas:

| Function | Status Atual | O que deveria ser |
|---|---|---|
| `generate-daily-guide` | Copia de audience-profile | Gerador de conteudo diario (6 categorias: hooks, storytelling, CTAs, cliffhangers, videoFormats, contentTypes) com contexto visceral |
| `generate-personalized-matrix` | Copia de audience-profile | Gerador da matriz de 30 dias com distribuicao programatica de elementos viscerais (distributeVisceralElements) |
| `generate-script` | Copia de audience-profile | Gerador de scripts com limite server-side (3/dia free) e contexto visceral completo |
| `generate-tools-content` | Copia de audience-profile | 4 ferramentas IA (dissonance, patterns, hooks, viral) com limite server-side (2 free) |
| `scheduled-push` | Copia de audience-profile | Sistema de push segmentado (PREMIUM, FREE_EARLY, FREE_TRIAL_END, FREE_EXHAUSTED, FREE_INACTIVE) |
| `send-push` | Copia de audience-profile | Web Push real com criptografia VAPID/aes128gcm |
| `transcribe-media` | Copia de audience-profile | Transcritor de audio/video via Lovable AI com limite server-side |
| `process-email-queue` | Copia de audience-profile | Processador de fila de emails com retries, DLQ, rate limiting |

### Functions que estao CORRETAS:
- `ai-chat` - OK (usa Lovable AI Gateway)
- `create-asaas-subscription` - OK
- `generate-audience-profile` - OK (com todos os prompts viscerais)
- `auth-email-hook` - OK
- `_shared/email-templates/*` - OK

### API Keys necessarias:
- **GOOGLE_GEMINI_API_KEY** - FALTANDO - necessaria para 5 functions (audience-profile, daily-guide, matrix, script, tools-content) que chamam a API do Google Gemini diretamente
- **ASAAS_API_KEY** - FALTANDO - necessaria para create-asaas-subscription
- **LOVABLE_API_KEY** - OK, ja configurada - usada por ai-chat e transcribe-media

### Bug menor no frontend:
- Warning de `forwardRef` no `Landing.tsx` (componente `Section` recebendo ref sem `forwardRef`)

---

## Plano de Correcao

### Etapa 1: Substituir as 8 Edge Functions pelo codigo correto do Aura OS
Sobrescrever cada arquivo `index.ts` com o codigo real do projeto original:
1. `generate-daily-guide/index.ts` - gerador de conteudo diario com contexto visceral
2. `generate-personalized-matrix/index.ts` - matriz 30 dias com `distributeVisceralElements()`
3. `generate-script/index.ts` - gerador de scripts com limite server-side
4. `generate-tools-content/index.ts` - 4 ferramentas IA (dissonance, patterns, hooks, viral)
5. `scheduled-push/index.ts` - push segmentado por tipo de usuario
6. `send-push/index.ts` - Web Push com VAPID/aes128gcm
7. `transcribe-media/index.ts` - transcritor com Lovable AI
8. `process-email-queue/index.ts` - processador de fila de emails

### Etapa 2: Adicionar os secrets faltantes
Solicitar ao usuario:
- `GOOGLE_GEMINI_API_KEY` - chave da API do Google AI Studio
- `ASAAS_API_KEY` - chave da API do Asaas (pagamentos)

### Etapa 3: Corrigir warning de forwardRef no Landing.tsx
Atualizar o componente `Section` para usar `React.forwardRef`

## Observacao sobre os prompts viscerais
Toda a logica de analise profunda de publico esta preservada e identica ao original:
- Step 1: Descricao detalhada do publico (demografia, psicografia, dores, desejos)
- Step 2: Perfil visceral com tool calling (30+ campos psicologicos)
- Os prompts do "Master Copywriter" estao intactos
- O schema da function `save_avatar_profile` esta completo com todos os campos (sevenSins, coreWounds, shameTriggers, etc.)

