

# Causa raiz confirmada e correção cirúrgica

## O que o diagnóstico provou

| Evidência | Conclusão |
|---|---|
| Repo na VPS está em `a43ed18` (HEAD = origin/main) | ✅ Código novo já está lá — H1 descartada |
| `printenv` no container mostra `GOOGLE_GEMINI_API_KEY=<set>` | ✅ Secret existe — mas só no escopo "shell" |
| Gemini direto retorna **200 OK** com `"Pong."` | ✅ Chave válida, sem quota, sem billing — H3 descartada |
| Container `supabase-edge-functions` rodando há 2h, sem restart loop | ✅ H4 descartada |
| **Logs do container repetem 51× `[Error] Missing required environment variables`** | 🎯 **Causa raiz** |

A mensagem `Missing required environment variables` **não vem do nosso código** — vem do próprio `edge-runtime:v1.71.2` (boot check). Isso significa que a variável que o runtime precisa ler **antes** de carregar qualquer função está ausente. Como `GOOGLE_GEMINI_API_KEY` está visível no `printenv`, a falta é de outra variável obrigatória — quase certamente uma das que o runtime do Supabase exige no boot:

- `SUPABASE_DB_URL`
- `JWT_SECRET` (ou `SUPABASE_AUTH_JWT_SECRET`)
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VERIFY_JWT`

O `printenv` filtrado só mostrou 4 variáveis (`ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `SUPABASE_URL`, `GOOGLE_GEMINI_API_KEY`). **Está faltando `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_DB_URL` dentro do container.** Isso explica matematicamente por que **toda função de IA falha**: o runtime aborta antes de invocar o handler — e como o handler nunca roda, o frontend recebe 500 / timeout.

Por que isso só atinge IA visivelmente? Porque as funções de IA são as únicas que o usuário invoca de forma intensiva e visível; webhooks de pagamento e push também estão quebrados, só que silenciosamente.

## Plano de correção (não muda código, só docker-compose)

### Fase A — confirmar quais variáveis estão faltando

Você roda mais um diagnóstico curto pra eu não chutar:

```bash
cd ~/supabase/docker
docker compose exec functions printenv \
  | grep -E "^(SUPABASE_|JWT_|VERIFY_JWT|ANON_|SERVICE_ROLE)" \
  | sed 's/=.*/=<set>/' \
  | sort
```

Isso lista **só** as variáveis-base do Supabase que o runtime exige. Tudo que **não** aparecer é o que precisa ser adicionado.

### Fase B — corrigir `docker-compose.yml`

Com base no resultado da Fase A, vou te entregar um patch exato pro bloco `services.functions.environment:` em `~/supabase/docker/docker-compose.yml`. O padrão será:

```yaml
services:
  functions:
    environment:
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_ANON_KEY: ${ANON_KEY}                  # ou SUPABASE_ANON_KEY conforme .env
      SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}  # idem
      SUPABASE_DB_URL: ${SUPABASE_DB_URL}
      JWT_SECRET: ${JWT_SECRET}
      VERIFY_JWT: "false"
      GOOGLE_GEMINI_API_KEY: ${GOOGLE_GEMINI_API_KEY}
      ASAAS_API_KEY: ${ASAAS_API_KEY}
      ASAAS_WEBHOOK_TOKEN: ${ASAAS_WEBHOOK_TOKEN}
```

E o comando final:

```bash
cd ~/supabase/docker
docker compose up -d --force-recreate functions
docker compose logs functions --tail 50 | grep -i "missing\|booted\|listening"
```

Esperado: as linhas `Missing required environment variables` somem e aparece algo como `Edge runtime listening` / `serving`.

### Fase C — validação no app

Logado como `agentevendeagente@gmail.com`, em aba anônima:
1. `/tasks` → "Gerar com IA" → deve retornar conteúdo
2. `/script` → gerar variação → deve retornar
3. `/tools` → qualquer ferramenta IA → deve retornar
4. Se algum ainda falhar, vou usar o supabase--edge_function_logs (no Lovable Cloud espelho) só pra leitura comparativa — mas a correção real fica na VPS.

## O que eu **não** vou tocar

- Nenhum arquivo `.ts` das edge functions
- Nenhum schema, RLS, migration
- Frontend, auth, push, asaas
- O `.env` da VPS (já está OK — o problema é só **mapear** essas vars pro service `functions` no compose)

## Plano B (se Fase B não resolver)

Restart completo do stack mantendo dados:

```bash
cd ~/supabase/docker
docker compose down
docker compose up -d
docker compose logs functions --tail 50
```

Se mesmo assim aparecer `Missing required environment variables`, o problema está na ordem de carregamento do `.env` pelo compose — entrego um terceiro bloco que injeta as vars via `env_file:` direto no service.

## Resumo executivo

- **Causa**: o service `functions` no `docker-compose.yml` não está recebendo todas as variáveis Supabase obrigatórias no boot.
- **Sintoma**: 100% das chamadas a edge functions falham silenciosamente.
- **Correção**: adicionar 4-5 linhas no bloco `environment:` do `docker-compose.yml` e recriar o container.
- **Risco**: baixíssimo. Não toca código, não toca banco, é reversível em 30 segundos.
- **Tempo**: ~2 minutos de execução na VPS depois da Fase A.

## Próximo passo

Quando aprovar este plano:
1. Volto em modo default
2. Te entrego **apenas o bloco da Fase A** pra colar
3. Você cola a saída
4. Eu retorno com o patch exato do `docker-compose.yml` adaptado às variáveis que estão de fato faltando
5. Você aplica e testa

