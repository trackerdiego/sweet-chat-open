

# Runtime 100% saudável — agora é validar IA no app com JWT real

## O que esses logs provam

Tudo verde no runtime:

| Sinal | Status |
|---|---|
| `main function started` único, sem `boot error` novos | ✅ |
| `hello` → HTTP 200 com payload correto | ✅ |
| `send-push` → 400 com mensagem de validação (worker carregou, só faltou body) | ✅ |
| `generate-script` / `generate-daily-guide` / `generate-tools-content` → HTTP 401 "Não autorizado" | ✅ esperado, prova que worker bootou e entrou no check de JWT |
| `process-email-queue` rodando via cron sem crash | ✅ |
| `Listening on http://localhost:9999/` em cada IA | ✅ |

**O entrypoint quebrado, o `Missing required environment variables` e o pool derrubado — tudo resolvido.** O 401 das IAs é o comportamento correto: elas exigem JWT de usuário logado, e os curls de smoke não tinham um.

## O que falta

Validar end-to-end **dentro do app**, com usuário logado, nos 3 fluxos que estavam falhando:

1. `/script` → gerar um script
2. `/tasks` → carregar/regenerar guia diário (`generate-daily-guide`)
3. `/tools` → rodar uma ferramenta IA (`generate-tools-content`)

Se algum falhar, o diagnóstico agora é **cirúrgico por function**, não mais "pool inteiro derrubado".

## Plano

### Passo 1 — Você testa no app (sem mudar nada)
Logado como usuário normal, abrir cada uma das 3 telas e disparar a ação de IA. Se as 3 funcionarem, fim — só atualizo memória.

### Passo 2 — Atualizar `mem://infra/deploy-workflow` com 2 regras críticas

Adicionar avisos pra nunca mais cairmos no mesmo bug:

- **Nunca usar `rsync --delete` no volume `~/supabase/docker/volumes/functions/`** — preserva `main/` e `hello/` que são bootstrap do edge-runtime e não existem no repo. Usar rsync sem `--delete` ou copiar function por function.
- **Se o volume for sincronizado novo (servidor novo, restore, etc.), recriar manualmente `main/index.ts` e `hello/index.ts`** com o template oficial do Supabase self-hosted (já documentado nesta conversa).

### Passo 3 — Só se algum fluxo falhar
Diagnóstico por function:
- Coletar log específico via `docker compose logs functions --since 2m | grep <function-name>`
- Identificar se é erro de JWT, env var, payload, resposta do Gemini ou bug interno
- Patch cirúrgico naquele arquivo, deploy, retest

## Risco
- Passo 1: zero, é só você usar o app
- Passo 2: zero, é update de memória
- Passo 3: só acontece se algo falhar, e já com escopo isolado

## O que NÃO vou fazer
- Não vou tocar em nenhum arquivo de IA preventivamente (tudo indica que estão saudáveis)
- Não vou mexer em env, compose ou volume
- Não vou propor refactor

## Próximo passo
Quando aprovar, em modo default eu:
1. Atualizo `mem://infra/deploy-workflow.md` com as 2 regras novas
2. Aguardo você testar `/script`, `/tasks` e `/tools` no app
3. Se tudo funcionar → fechamos. Se algo falhar → você me cola o erro e eu vou direto naquela function.

