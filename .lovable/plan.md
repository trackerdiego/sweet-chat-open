# Escudo de IA aplicado nas 2 functions do onboarding

Adicionado retry 3x + fallback `gemini-1.5-flash` em:
- `generate-audience-profile` (cobre os 2 fetches: step1 e step2)
- `generate-personalized-matrix`

Mesmo padrão `callGeminiResilient` das outras 3.

## Deploy VPS (depois de resolver o git pull travado)

```bash
cd /root/app

git checkout -- supabase/functions/generate-daily-guide/index.ts \
                supabase/functions/generate-script/index.ts \
                supabase/functions/generate-tools-content/index.ts

git status
git pull origin main

export SUPABASE_ACCESS_TOKEN="<TOKEN_REAL_DO_STUDIO>"
export PROJECT_REF="default"

./scripts/deploy-selfhost.sh
```

## Validação

```bash
docker compose -f ~/supabase/docker/docker-compose.yml logs functions --since 5m 2>&1 \
  | grep -iE "audience-step|matrix|gemini|fallback|attempt" | tail -40
```

Depois testa: regenerar matriz / refazer onboarding.
