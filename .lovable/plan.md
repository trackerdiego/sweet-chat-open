# Ferramenta: Descrição de Reels

Nova tool que recebe um vídeo (ou texto/transcrição) e devolve uma descrição pronta pra colar no Instagram — com hook na 1ª linha, corpo escaneável, emojis estratégicos, CTA e bloco de hashtags. Reusa 100% da infra existente (FFmpeg no front, `media-uploads`, `start-transcription-job`, `start-tools-job`, `ai_jobs`, polling, quotas, cleanup).

---

## 1. Backend — `start-tools-job` (1 arquivo, sem migration)

Adicionar nova chave `reelsDescription` em `TOOL_PROMPTS` e `TOOL_SCHEMAS`:

- **System prompt**: Master copywriter de Instagram. Recebe perfil visceral (avatar, feridas, gatilhos verbais, desejo oculto, relatabilidade) + nicho + estilo. Regras: 1ª linha é hook que segura o scroll, máx 2200 chars, emojis com propósito (não decoração), quebras de linha curtas (mobile-first), CTA conversacional no fim, 8-15 hashtags mistas (3 amplas, 5 nicho, 3-5 cauda longa). Linguagem neutra de gênero.
- **User prompt**: Recebe `userInput` (transcrição do reel ou descrição do tema) + nicho. Pede a descrição final.
- **Schema (structured output)**:
  ```
  {
    hookLine: string,           // 1ª linha
    body: string,               // corpo já com \n e emojis
    cta: string,                // chamada final
    fullCaption: string,        // hookLine+body+cta concatenado pronto pra copiar
    hashtags: string[],         // 8-15 sem #
    alternativeHooks: string[]  // 3 alternativas pra A/B
  }
  ```

Sem mudança em quotas (já consome `tool_generations`). Sem secret novo.

## 2. Frontend — `src/pages/Tools.tsx`

- Novo card no array `tools`: `{ id: 'reelsDescription', icon: Instagram, title: 'Descrição de Reels', description: 'Cole o tema OU envie o vídeo — recebe legenda pronta', needsInput: true, inputPlaceholder: 'Cole a transcrição/tema do reel ou envie o vídeo abaixo...', inputLabel: 'Conteúdo do reel' }`.
- O bloco de upload de vídeo/áudio já existe e popula `userInput` via transcrição → reaproveita sem mudança. A tool aceita texto direto também.
- Novo `ResultCard` para `reelsDescription`: card grande com `fullCaption` em `<pre>` selecionável, botão "Copiar legenda", chip de contador de caracteres (com aviso >2200), seção de hashtags com botão "Copiar hashtags", accordion com 3 hooks alternativos.
- Tipagem: estender `ToolType` para incluir `'reelsDescription'`.

## 3. Tutorial Wistia (`src/data/tutorials.ts`)

Placeholder no tópico `tools` indicando "Descrição de Reels" — o usuário grava o vídeo depois e troca o `mediaId`.

## 4. Higiene & escala (1 migration + 1 cron)

Pra não estourar Storage/DB conforme escala:

- **Lifecycle Storage `media-uploads`**: política via SQL no Studio self-hosted (anexa no bloco copia-e-cola final) — `delete from storage.objects where bucket_id='media-uploads' and created_at < now() - interval '24 hours'`. Roda via `pg_cron` 1×/dia. Rede de segurança caso transcrição falhe antes do `.remove()`.
- **Purge `ai_jobs`**: cron diário deleta jobs `done`/`failed` com `created_at < now() - interval '30 days'`. Mantém auditoria razoável sem inflar a tabela.
- Ambos via `cron.schedule` direto no Postgres (sem edge function nova).

## 5. Detalhes técnicos

- Modelo: `gemini-2.5-flash` primário (igual outras tools), `flash-lite` mid, `pro` fallback. `maxOutputTokens: 2500` (caption + hashtags + alternativos cabem).
- Validação no front: se `userInput` vazio E sem upload, bloqueia.
- Quota: conta como 1 `tool_generation` (free 2/dia, premium ilimitado). Se usuário fizer upload, gasta também 1 `transcription` (já é o comportamento atual).
- Sem mudança em RLS — `ai_jobs` e `audience_profiles` já cobertos.

## 6. Entrega VPS

Final da resposta de implementação trará bloco copia-e-cola:
- `git pull` + `./scripts/deploy-selfhost.sh start-tools-job` (frontend já vai por Vercel automaticamente)
- SQL pra Studio self-hosted: criação dos 2 cron jobs (`pg_cron`/`pg_net` já habilitados conforme padrão do projeto).

---

## Out of scope

- Sem agendamento/postagem direta no Instagram (Graph API exigiria conta business + revisão Meta — outra fase).
- Sem geração de capa/thumb (outra ferramenta).
- Sem histórico persistente de descrições geradas (resultado fica na sessão; podemos adicionar depois se virar pedido).
