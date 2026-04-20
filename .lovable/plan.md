

# Trocar fallback de `gemini-2.0-flash` (deprecado) para `gemini-2.5-flash`

## Diagnóstico

Novo erro 404 do Google:
> `This model models/gemini-2.0-flash is no longer available to new users.`

O `gemini-2.0-flash` foi descontinuado pra contas novas. Nosso fallback está apontando pra ele. Resultado: primário falha → fallback retorna 404 → onboarding morre.

Como o primário também é `gemini-2.5-flash` (e ele que está dando `MALFORMED_FUNCTION_CALL` em `daily-guide` e `tools-content`), só trocar o fallback pra 2.5-flash não resolve **as 2 functions com schema pesado** — vai cair no mesmo modelo bugado.

## Plano em 2 partes

### Parte 1 — Fix imediato do 404 (desbloqueia onboarding e matriz)

Trocar `FALLBACK_MODEL = "gemini-2.0-flash"` por `"gemini-2.5-flash"` nas 5 functions:
- `supabase/functions/generate-script/index.ts`
- `supabase/functions/generate-daily-guide/index.ts`
- `supabase/functions/generate-tools-content/index.ts`
- `supabase/functions/generate-audience-profile/index.ts`
- `supabase/functions/generate-personalized-matrix/index.ts`

Isso resolve `audience-profile`, `personalized-matrix` e `script` — que já funcionavam no 2.5 e só precisavam de um fallback válido.

### Parte 2 — Fix do MALFORMED em `daily-guide` e `tools-content`

Como o 2.5-flash quebra com schema complexo nessas 2 functions, mudar o **primário** delas pra `gemini-2.5-pro` (mesmo modelo que `audience-profile` e `matrix` usam, e que não dá MALFORMED). Manter `gemini-2.5-flash` como fallback.

Mudança em 1 linha por arquivo:
- `supabase/functions/generate-daily-guide/index.ts`: `PRIMARY_MODEL = "gemini-2.5-pro"`
- `supabase/functions/generate-tools-content/index.ts`: `PRIMARY_MODEL = "gemini-2.5-pro"`

Pro é mais lento e caro, mas é o que tolera os schemas dessas functions. Se ficar lento demais, a Parte 3 (futura) seria simplificar os schemas — não vou mexer agora.

## Bloco de deploy (depois da aprovação)

```bash
cd /root/app
git checkout -- supabase/functions/
git pull origin main
cp -r supabase/functions/generate-audience-profile \
      supabase/functions/generate-personalized-matrix \
      supabase/functions/generate-script \
      supabase/functions/generate-daily-guide \
      supabase/functions/generate-tools-content \
      ~/supabase/docker/volumes/functions/
docker compose -f ~/supabase/docker/docker-compose.yml restart functions
```

## Validação

```bash
docker compose -f ~/supabase/docker/docker-compose.yml logs functions --follow 2>&1 \
  | grep -iE "audience|matrix|daily-guide|tools-content|gemini|fallback|MALFORMED|404|error"
```

Esperado:
- Zero ocorrências de `gemini-2.0-flash` nos logs
- Zero `404` de modelo deprecado
- `daily-guide` e `tools-content` rodando sem `MALFORMED_FUNCTION_CALL`
- Onboarding completo: 4 passos verdes

## O que NÃO vou fazer

- Não vou mexer no frontend do onboarding (problema é 100% backend)
- Não vou simplificar schemas ainda (trocar pra 2.5-pro deve resolver — mais barato em esforço)
- Não vou mexer em `scripts/deploy-selfhost.sh` agora (fica pra depois que confirmar fix)
- Não vou mudar o primário das outras 3 functions (já funcionam)

