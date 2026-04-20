

# Onboarding falhou após "Regenerar Matriz" — diagnóstico antes de qualquer fix

## O que você relatou

Clicou em "Regenerar Matriz" → voltou pro onboarding → **passo 1 deu verde**, **todos os outros ficaram vermelhos**.

Isso bate com o problema do Gemini 503 que estamos perseguindo: o onboarding chama 3 edge functions de IA em sequência (`generate-audience-profile`, `generate-personalized-matrix`, `generate-daily-guide`). Se o Gemini está caindo, os passos 2-4 quebram em cadeia.

**Mas antes de afirmar isso, preciso confirmar 2 coisas que ainda não sei:**

1. O deploy na VPS efetivamente rodou? (você travou no `git pull` da última vez por causa de edits locais + token placeholder)
2. Qual é o erro EXATO que apareceu nos passos vermelhos? (mensagem da UI ou logs)

## Plano de ação (ordem importa)

### Passo 1 — Resolver o deploy travado na VPS (bloco copia-e-cola)

Esse é o bloco que você pediu ("qual bloco?"). Roda na VPS:

```bash
cd /root/app

# Descarta edits locais que a outra IA fez via sed
git checkout -- supabase/functions/generate-daily-guide/index.ts \
                supabase/functions/generate-script/index.ts \
                supabase/functions/generate-tools-content/index.ts

# Confirma worktree limpo
git status

# Pull do GitHub (agora passa)
git pull origin main

# Exporta variáveis com valores REAIS (não copie literal "seu-token")
export SUPABASE_ACCESS_TOKEN="<TOKEN_REAL_DO_STUDIO>"
export PROJECT_REF="default"

# Deploy
./scripts/deploy-selfhost.sh
```

Onde achar o token real: Studio em `https://api.influlab.pro` → ícone de perfil → Account → Access Tokens.

### Passo 2 — Capturar logs das 3 functions do onboarding

Logo após o deploy, na VPS:

```bash
docker compose -f ~/supabase/docker/docker-compose.yml logs functions --since 10m 2>&1 \
  | grep -iE "generate-audience-profile|generate-personalized-matrix|generate-daily-guide|gemini|fallback|attempt|status: 5|status: 4" \
  | tail -60
```

Cola o output aqui. Isso me diz exatamente em qual passo quebra e por quê.

### Passo 3 — Sob suspeita: `generate-personalized-matrix` e `generate-audience-profile` NÃO têm o escudo

As 3 functions que blindei (`generate-script`, `generate-daily-guide`, `generate-tools-content`) ganharam retry 3x + fallback `gemini-1.5-flash`. Mas o onboarding também usa:

- `generate-audience-profile` — sem escudo
- `generate-personalized-matrix` — sem escudo

Se o Gemini está com 503 intermitente, essas 2 também quebram. **Provavelmente é aqui que os passos vermelhos morreram.**

### Passo 4 — Ação após confirmar (próximo plano)

Dependendo dos logs do Passo 2, vou:

- **Se confirmar 503 nas 2 functions sem escudo**: aplicar o mesmo padrão `callGeminiResilient` (retry 3x + fallback) em `generate-audience-profile` e `generate-personalized-matrix`. 2 arquivos, mesma estrutura do que já fiz.
- **Se for outro erro** (auth, schema, payload): patch específico baseado na mensagem real.
- **Se for cota Google esgotada**: aí é billing no Google AI Studio, não dá pra resolver no código.

## O que NÃO vou fazer agora

- Aplicar o escudo nas 2 functions sem ver os logs primeiro (pode ser outro problema; não quero gastar deploy à toa)
- Mexer no fluxo de retry do frontend do onboarding (provavelmente o backend é o culpado)
- Tocar em DB / RLS / migrations

## Resumo do que preciso de você

1. Roda o bloco do Passo 1 na VPS (com token real)
2. Roda o comando de logs do Passo 2 e cola o output
3. Eu volto com o patch (provavelmente blindar as 2 functions do onboarding)

