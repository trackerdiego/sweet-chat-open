
Trocar o modelo da edge function `generate-audience-profile` de `gemini-2.5-flash` para `gemini-2.5-pro` para aumentar a profundidade e qualidade da análise visceral (perfil psicológico de 30+ campos).

## Mudança

**Arquivo:** `supabase/functions/generate-audience-profile/index.ts`

Duas chamadas Gemini na função, ambas trocam de modelo:

1. **Step 1** (geração da descrição do público): `gemini-2.5-flash` → `gemini-2.5-pro`
2. **Step 2** (perfil visceral via tool calling): `gemini-2.5-flash` → `gemini-2.5-pro`

Nenhuma outra mudança de código — endpoint, autenticação, schema da tool e prompts permanecem iguais. O Pro entende o mesmo formato OpenAI-compatible.

## O que NÃO muda

- Outras 14 edge functions continuam em `gemini-2.5-flash` (chat, matriz, script, daily-guide, tools-content, etc.)
- Schema do banco
- Frontend / UX do onboarding
- Secrets (mesma `GOOGLE_GEMINI_API_KEY`)

## Trade-offs esperados

| Aspecto | Antes (Flash) | Depois (Pro) |
|---|---|---|
| Qualidade do perfil | Boa | Mais profundo, específico, visceral |
| Latência da etapa visceral | ~8-15s | ~20-40s |
| Custo por geração | ~$0.001 | ~$0.01 (~10x) |
| Estabilidade | GA | GA |

O onboarding já tem loading state e fallback de erro (`mem://ux/onboarding-flow`), então a latência maior não quebra UX.

## Deploy no self-hosted

⚠️ Importante: como o backend é self-hosted (`api.influlab.pro`), Lovable atualiza o código da function aqui mas o **deploy real** precisa acontecer no seu servidor. Após eu aplicar a mudança, você precisa:

```bash
cd ~/supabase/docker
docker compose restart functions
```

Ou redeployar especificamente a `generate-audience-profile` se você usa deploy seletivo.

## Validação pós-deploy

1. Cria conta de teste nova
2. Roda onboarding completo
3. Confere no Studio self-hosted: `select avatar_profile from audience_profiles where user_id = '<novo-user>';`
4. Compara profundidade com perfis antigos gerados pelo Flash
