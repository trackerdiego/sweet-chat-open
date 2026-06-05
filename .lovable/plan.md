# Reels Description — Modo fiel ao vídeo

## Problema
Hoje o `reelsDescription` em `supabase/functions/start-tools-job/index.ts` injeta no prompt:
- `niche` (vindo da matriz do usuário)
- `style` (estilo de conteúdo do usuário)
- Bloco inteiro do `audience_profile` (avatar, feridas, desejo oculto, gatilhos verbais, objeções, relatabilidade)
- Regra de hashtags que pede "5 do nicho"

Resultado: a legenda é reescrita pra encaixar no nicho da matriz em vez de refletir o que o usuário falou no Reel.

## Mudança
Reescrever apenas o prompt da chave `reelsDescription` (system + user) pra:

1. **Ignorar** `ap` (audience profile), `niche` e `style` — não passar nada disso pro Gemini nesta tool.
2. **Instrução central**: a legenda deve ser FIEL ao conteúdo transcrito/tema enviado. A IA é copy de Instagram, não estrategista de nicho. Não pode inventar produto, público, autoridade, oferta ou ângulo que não esteja no texto.
3. **Hook**: extraído do que o usuário efetivamente diz no vídeo (primeiros segundos ou ideia central), não de gatilhos do avatar.
4. **Hashtags**: derivadas do TEMA do vídeo (palavras-chave do próprio conteúdo) — remover a regra "5 do nicho". Manter: 8-15 hashtags, mix de amplas + específicas do tema + cauda longa, minúsculas, sem acento, sem `#`.
5. **Manter**: regras de formato (2200 chars, quebras curtas mobile-first, emojis com propósito, CTA conversacional, 3 hooks alternativos, schema de saída inalterado, `PT_BR_RULES`).

Nada muda no schema `TOOL_SCHEMAS.reelsDescription`, no frontend (`Tools.tsx`), nem no fluxo de job.

## Entrega
- Editar `supabase/functions/start-tools-job/index.ts`: substituir só o bloco `reelsDescription` em `TOOL_PROMPTS` (system + user) pela versão niche-agnostic.
- Bloco copia-e-cola pra VPS no fim:
  ```
  ./scripts/deploy-selfhost.sh start-tools-job
  ```

Sem migrations, sem mudança em outras tools (dissonance/patterns/hooks/viral continuam usando nicho — é o comportamento correto delas).
