

# Plano: corrigir chat truncado + daily-guide quebrado

## Diagnóstico

**Problema 1 — Chat (resposta truncada igual ao print):**
- `ai-chat/index.ts` linha 165: `maxOutputTokens: 1500`
- System prompt soma ~3-5K tokens (perfil + estudo visceral em JSON puro)
- Quando o usuário pede "5 ideias de Reels", cada ideia tem título + explicação + porquê emocional + CTA → estoura 1500 tokens facilmente
- Gemini retorna `finishReason: MAX_TOKENS`, frontend renderiza o que chegou (parcial) e o stream encerra no meio da frase
- É exatamente o que aparece no print: corta em "Seu público tem a..."

**Problema 2 — Daily Guide nunca funciona:**
- Linha 14 do log do boot: `parallel A+B` — faz 2 chamadas Gemini em paralelo, no mesmo padrão que causava 503 no matrix antes do stagger
- Sem stagger entre A e B → Google throttla → 503 → 3 retries → fallback `flash-lite` → costuma falhar a chamada B (taskExamples) → frontend recebe payload incompleto ou erro
- Pior: se A passa mas B 503ou de vez, o código atual já trata `B rejected` como "ok, segue sem taskExamples" (linha 113 do arquivo), MAS o frontend mostra `toast.error` se vier qualquer erro top-level

## Solução

### Frente A — Chat sem truncamento

Em `supabase/functions/ai-chat/index.ts`:

1. **Subir `maxOutputTokens` de 1500 → 4000.** O Gemini cobra por token usado, não por reservado. 4000 é seguro pra qualquer pergunta normal.

2. **Encolher o system prompt.** Hoje injeta `JSON.stringify(avatar, null, 2)` inteiro (~2-3K tokens só do avatar). Vai virar um resumo dos campos críticos:
   - Avatar (nome arquetípico)
   - Medo supremo  
   - Desejo oculto
   - Top 3 feridas
   - Top 5 gatilhos verbais
   - Top 3 frustrações
   
   Isso reduz input em ~70% sem perder o "consultor que conhece o público".

3. **Reforçar o limite de saída no prompt.** Já existe "máximo 400 palavras" — mas o Gemini ignora quando o contexto é gigante. Com prompt menor + 4000 tokens de margem, vira realidade.

### Frente B — Daily Guide estável

Em `supabase/functions/generate-daily-guide/index.ts`:

1. **Stagger entre chamada A e B** (mesmo truque que arrumou o matrix):
```ts
const [resA, resB] = await Promise.allSettled([
  callGeminiNative({ ...A }),
  new Promise(r => setTimeout(r, 800)).then(() => callGeminiNative({ ...B })),
]);
```

2. **Se A der 503 final, retry com `flash-lite` direto** em vez de devolver erro 503/504. Hoje se A falha, a função inteira aborta. Vai virar: tenta `flash` → cai pra `flash-lite` (já existe no wrapper, está funcionando no matrix).

3. **Se B falhar, devolver A parcial sem erro** (já é assim no código, mas garantir que `taskExamples = {}` não dispara `data?.error` no frontend). Conferir se o `200 ok com taskExamples vazio` está passando limpo no `DailyGuide.tsx`.

4. **Atualizar log de boot** pra `[daily-guide] boot — staggered A+B (800ms)` pra confirmar deploy.

## Arquivos alterados

1. **`supabase/functions/ai-chat/index.ts`**
   - `maxOutputTokens: 4000`
   - Função `buildAvatarSummary(avatar)` que extrai só os campos críticos
   - System prompt usa o resumo em vez do JSON inteiro

2. **`supabase/functions/generate-daily-guide/index.ts`**
   - Stagger 800ms na chamada B
   - Log de boot atualizado
   - Garantir resposta 200 mesmo se B falhar (já é, só revisar)

## O que NÃO muda

- Wrapper `_shared/gemini.ts` (não toca)
- Frontend `AiChat.tsx` e `DailyGuide.tsx` (sem alterações)
- Schemas, modelos, retry policy

## Critério de sucesso

- Pergunta "Me dê 5 ideias de Reels" no chat retorna **resposta completa** com 5 ideias inteiras, sem cortar
- "Gerar sugestões com IA" no Daily Guide funciona em <30s, sem toast de erro, com as 6 categorias preenchidas
- Logs mostram `[ai-chat]` e `[daily-guide] staggered A+B` sem 503 sequencial

## Bloco de deploy pra VPS

```bash
cd /root/app && git checkout -- supabase/functions/ && git pull origin main
cp -r supabase/functions/ai-chat/. ~/supabase/docker/volumes/functions/ai-chat/
cp -r supabase/functions/generate-daily-guide/. ~/supabase/docker/volumes/functions/generate-daily-guide/
docker compose -f ~/supabase/docker/docker-compose.yml restart functions
```

Validação:
```bash
docker compose -f ~/supabase/docker/docker-compose.yml logs functions --since 1s --follow 2>&1 \
  | grep -iE "ai-chat|daily-guide|503|MAX_TOKENS|staggered"
```

## Detalhes técnicos

```text
Por que 4000 tokens é seguro:
- Output médio do consultor IA: 300-600 tokens
- 5 ideias bem desenvolvidas: 800-1200 tokens
- Resposta longa atípica: até 2500 tokens
- 4000 dá folga 1.5x sem custo (cobra pelo usado)

Por que resumir avatar:
- avatar_profile completo tem ~30 campos × 2-5 itens cada
- JSON.stringify gera ~2500-4000 tokens de input por mensagem
- Em conversa de 10 turnos, são ~30K tokens de contexto repetido
- Resumo cabe em 400 tokens com os campos que importam pro consultor

Por que stagger no daily-guide:
- Mesmo padrão do matrix: 2 fetch() no mesmo event loop tick = burst
- Google throttla 1 das 2 chamadas com 503
- 800ms de espaçamento elimina o burst sem virar sequencial
- Custo: +0.8s no total (irrelevante)
```

