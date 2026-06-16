## Objetivo

Quando o upload de vídeo retornar uma transcrição vazia ou muito curta (provavelmente um vídeo sem fala — dancinha, trend puramente visual, etc.), avisar o user de forma honesta e deixar ele decidir se quer prosseguir com a análise mesmo assim ou cancelar e tentar outro vídeo.

Tudo client-side. **Zero mudança de infra, zero edge function, zero SQL, zero alteração no fluxo de upload ou no limite de transcrições.**

## Escopo

Mudança em um único arquivo: `src/pages/Tools.tsx`, dentro de `handleFileUpload`. Afeta as duas tools que aceitam upload (`viral` — Roubar Trend Viral, e `reelsDescription` — Descrição de Reels) automaticamente, porque o handler é compartilhado.

## Comportamento novo

Hoje (Tools.tsx linha 364):
```text
transcrição retorna → insere no textarea → toast "Transcrição concluída"
```

Depois:
```text
transcrição retorna
  ├─ vazia OU < 50 chars → abre AlertDialog:
  │     título: "Esse vídeo parece não ter fala"
  │     corpo: explica que a análise depende de texto falado e pode
  │            ficar fraca em vídeos puramente visuais (dancinhas, trends
  │            sem narração). Sugere tentar vídeo com narração/diálogo.
  │     botões:
  │       - "Tentar outro vídeo" (cancela, limpa input)
  │       - "Analisar mesmo assim" (insere o que veio + segue normal)
  └─ >= 50 chars → fluxo atual inalterado
```

A transcrição **já consumiu** a cota (worker incrementa server-side), então não tem como "estornar" — isso fica explícito no aviso: "essa transcrição já foi contabilizada no seu uso diário".

## Implementação técnica

1. **Estado novo em `Tools.tsx`**:
   - `lowQualityTranscription: string | null` — guarda o texto que veio curto/vazio, controla abertura do dialog.

2. **No `handleFileUpload`** (após receber `transcribeResult`):
   - Calcular `text = (transcribeResult.transcription ?? "").trim()`.
   - Se `text.length < 50`: setar `lowQualityTranscription` (usar `""` quando vazio pra ainda abrir o dialog) e **não** inserir no textarea ainda. Não exibir o toast de sucesso. Ainda chamar `refreshUsage()`.
   - Se `text.length >= 50`: comportamento atual (insere + toast).

3. **Novo `<AlertDialog>`** no JSX (usar `@/components/ui/alert-dialog` que já existe no shadcn padrão):
   - Aberto quando `lowQualityTranscription !== null`.
   - Confirmação ("Analisar mesmo assim") insere o texto no `userInput` (mesma lógica de concat atual) e fecha.
   - Cancelamento ("Tentar outro vídeo") só fecha; não mexe no input.

4. **Sem mudanças** em: extração de áudio, upload pro Storage, `start-transcription-job`, contagem de uso, prompts das tools, limites, ou qualquer outra coisa.

## O que NÃO entra neste plano

- Detecção visual / análise multimodal de vídeos sem fala.
- Aumento de limite de upload, mudança de bucket, ou envio do .mp4 cru pro Gemini.
- Diferenciar threshold por tool (ambas tools tratam vídeos sem fala da mesma forma).
- Persistir métricas de "quantos uploads bateram o aviso" (pode ser adicionado depois se você quiser sinal pra decidir investir em análise visual).

## Verificação após implementar

- Subir um vídeo curto sem fala (ou cancelar a fala) → dialog deve aparecer.
- Clicar "Analisar mesmo assim" → texto (mesmo curto) entra no input, fluxo de geração funciona.
- Clicar "Tentar outro vídeo" → input fica intacto, pode subir outro arquivo.
- Subir vídeo com narração normal → fluxo idêntico ao atual, sem dialog.
