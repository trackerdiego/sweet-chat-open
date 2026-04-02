

# Auditoria Freemium — Vulnerabilidades e Melhorias

## Status Atual

As limitações freemium estão parcialmente implementadas. Há validação **server-side** (nas Edge Functions) e **client-side** (no frontend). Porém existem falhas importantes que permitem uso gratuito ilimitado em algumas features.

## Problemas Encontrados

### 1. `generate-daily-guide` — SEM LIMITE (CRÍTICO)
A Edge Function `generate-daily-guide` **não verifica limites nem incrementa contadores**. Qualquer usuário free pode gerar sugestões IA do Guia do Dia infinitamente. Isso consome créditos de IA sem controle.

### 2. `generate-tools-content` — Reset diário quebrado no server
A Edge Function verifica `tool_generations >= 2`, mas **não considera a data** (`last_tool_date`). Se o usuário usou 2 gerações ontem, o servidor ainda bloqueia hoje porque não reseta o contador. O frontend reseta corretamente, mas o backend não.

### 3. `transcribe-media` — Mesmo problema de reset
Verifica `transcriptions >= 2` sem considerar `last_transcription_date`. Mesmo problema: limites não resetam no dia seguinte no servidor.

### 4. Limite de dias (free_days: 7) — Apenas client-side
A restrição de "só acessar até o dia 7" é verificada **apenas no frontend** via `canAccessDay()`. As Edge Functions de script e guide não verificam se o dia solicitado está dentro do limite free. Um usuário técnico poderia chamar a API diretamente para gerar conteúdo de qualquer dia.

## O Que Já Funciona Bem

- `generate-script` — Verifica limite E data corretamente no servidor
- `ai-chat` — Verifica limite no servidor (mas sem reset diário — acumula para sempre, o que é **mais restritivo** que o frontend indica com "10 por dia")
- Frontend mostra contadores e banners de upgrade corretamente
- `PremiumGate` bloqueia conteúdo visual e redireciona ao checkout

## Plano de Correção

### Arquivo 1: `supabase/functions/generate-daily-guide/index.ts`
Adicionar verificação de limites com a mesma lógica do `generate-script`:
- Buscar `user_usage` com `is_premium, tool_generations, last_tool_date`
- Verificar se é o mesmo dia; se não, resetar contador
- Bloquear se `>= 2` (usar o mesmo limite de tools, já que é geração de conteúdo IA)
- Incrementar contador e registrar em `usage_logs`

### Arquivo 2: `supabase/functions/generate-tools-content/index.ts`
Corrigir para considerar `last_tool_date`:
- Buscar `last_tool_date` junto com os dados
- Se a data for diferente de hoje, tratar contagem como 0
- Atualizar `last_tool_date` junto com o incremento

### Arquivo 3: `supabase/functions/transcribe-media/index.ts`
Mesma correção — considerar `last_transcription_date`:
- Buscar a data junto com os dados
- Comparar com hoje antes de verificar o limite

### Arquivo 4: `supabase/functions/ai-chat/index.ts`
Corrigir para considerar `last_chat_date`:
- Buscar `last_chat_date` junto com os dados
- Se a data for diferente de hoje, tratar `chat_messages` como 0
- Atualizar `last_chat_date` junto com o incremento

## Resumo das Alterações

| Edge Function | Problema | Correção |
|---|---|---|
| `generate-daily-guide` | Sem limite algum | Adicionar verificação completa |
| `generate-tools-content` | Não reseta por dia | Adicionar lógica de data |
| `transcribe-media` | Não reseta por dia | Adicionar lógica de data |
| `ai-chat` | Não reseta por dia | Adicionar lógica de data |

Todas as 4 correções seguem o mesmo padrão já implementado em `generate-script` (que é o único correto).

