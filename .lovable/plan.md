

# Deploy completo — agora é validar no app

## O que esses logs provam

Tudo aplicado com sucesso na VPS:

| Etapa | Status |
|---|---|
| `kong.yml` patch (timeouts 300s nas rotas `functions-v1`) | ✅ aplicado |
| `docker compose restart kong` | ✅ |
| `git pull` trouxe os 5 arquivos novos (ai-chat, 3 IAs, tailwind) | ✅ |
| `rsync` SEM `--delete` (preservou `main/` e `hello/`) | ✅ |
| `docker compose restart functions` | ✅ |
| `main function started` único, sem `boot error` | ✅ runtime saudável |

**Backend está 100% deployado com as correções:** Kong agora aguarda até 5 min, e as functions têm `max_tokens` controlado + retry mais curto.

## O que falta — validar no app (sem mudar nada)

### Teste 1 — `/script` (era o pior caso de 504)
- Logado, abrir `/script`
- Gerar script **2x seguidas** (a 2ª era a que estourava antes)
- Esperado: ambas retornam em 30–90s, sem 504

### Teste 2 — `/tasks`
- Abrir `/tasks`, esperar guia diário carregar
- Se for o primeiro acesso do dia, vai chamar `generate-daily-guide`
- Esperado: carrega sem 504

### Teste 3 — `/tools`
- Rodar uma ferramenta de IA (ex: gerador de hooks)
- Esperado: responde sem 504

### Teste 4 — AI Chat (era o problema da formatação)
- Abrir o chat, clicar na sugestão "Me dê 5 ideias de Reels para essa semana"
- Esperado:
  - Resposta mais rápida (`max_tokens: 1500` + system prompt pedindo concisão)
  - Formatada com **negrito**, listas numeradas, parágrafos curtos (graças ao `@tailwindcss/typography` + `ReactMarkdown`)
  - Máximo ~400 palavras, não mais bloco gigante

## ⚠️ IMPORTANTE — frontend Vercel

O frontend (Vercel) também precisa estar com o build novo pra o AI Chat formatado funcionar — porque a mudança do `tailwind.config.ts` (typography plugin) é **frontend**, não backend.

Verificar:
- Vercel já fez auto-deploy do commit `227f7df`?
- Se sim, hard-refresh no navegador (Ctrl+Shift+R) pra pegar o CSS novo
- Se não, esperar o deploy do Vercel completar antes de testar o chat

## O que vou fazer (modo default)

Nada de código. Só esperar seu retorno. Se algum teste falhar:
- Coletar logs específicos via `supabase--edge_function_logs` da function que falhou
- Patch cirúrgico naquele arquivo
- Novo deploy

Se tudo funcionar:
- Atualizar `mem://infra/deploy-workflow.md` com a nova regra "Kong precisa de timeout 300s nas rotas `functions-v1` em qualquer setup self-hosted novo"
- Fechar o ciclo

## Próximo passo

Quando aprovar este plano, eu volto em modo default só pra confirmar a memória. Mas **antes disso, por favor**:
1. Confirme que o Vercel já buildou o commit `227f7df`
2. Faça os 4 testes acima
3. Me diga: tudo ok, ou cole o erro específico de qualquer teste que falhar

