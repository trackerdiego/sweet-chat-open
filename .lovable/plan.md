

# Causa raiz IDENTIFICADA — falta o `main` worker

## O que o passo 6 revelou

```
worker boot error: failed to bootstrap runtime: could not find an appropriate entrypoint
```

E o `command:` do compose mostra:
```
command: start --main-service /home/deno/functions/main
```

O edge-runtime do Supabase exige um worker chamado `main` em `/home/deno/functions/main/index.ts` que faz o roteamento pras outras functions. Esse `main` (e o `hello`) **existiam antes** no volume mas foram **deletados pelo `rsync --delete`** do passo 3:

```
deleting main/index.ts
deleting main/
deleting hello/index.ts
deleting hello/
```

Eles não existem no repo `/root/app/supabase/functions/` porque são artefatos de bootstrap do self-hosted, não do projeto. O `rsync --delete` foi agressivo demais.

**Daí o sintoma original ("Missing required environment variables") aparecia 51× no log antigo**: era o `main` worker tentando bootar, falhando no check de env do **próprio main**, e cada request invocando uma function nova fazia o pool tentar rebootar. Agora sem o `main` o erro mudou de cara mas a causa raiz é a mesma família: **o `main` está quebrado/ausente**.

## Plano de correção (3 passos curtos)

### Passo 1 — Recuperar `main/index.ts` e `hello/index.ts`

Eles existem no template oficial do Supabase self-hosted. Vou te entregar o conteúdo exato dos 2 arquivos pra colar via heredoc na VPS — `main` é o roteador padrão, `hello` é só placeholder de healthcheck.

### Passo 2 — Restart do serviço

```
docker compose restart functions
sleep 5
docker compose logs functions --tail 50 | grep -iE "boot|listening|error"
```

Esperado: `serving requests on 0.0.0.0:9000` ou similar, sem erro.

### Passo 3 — Validar IAs no app

`/tasks`, `/script`, `/tools`, dashboard. Se funcionar, atualizo a memória:
- **`mem://infra/deploy-workflow`** ganha aviso explícito: "Nunca usar `rsync --delete` no volume de functions — precisa preservar `main/` e `hello/`. Usar rsync sem `--delete` ou copiar function por function."

## Por que essa é a correção certa (e não outra)

| Hipótese alternativa | Por que NÃO é |
|---|---|
| Bug nas functions de IA | Erro é no boot do `main`, antes de qualquer function de IA carregar |
| Falta de env var | `printenv` da Fase A já provou que tudo está setado |
| Cache antigo do Deno | `down + up` recriou o container do zero |
| Bundle stale | Volume foi sincronizado e a string antiga sumiu (passo 4) |

A pista decisiva é a **mudança da mensagem de erro** depois do `rsync --delete`: de "Missing required environment variables" pra "could not find an appropriate entrypoint". Isso só acontece quando o entrypoint configurado no `command:` deixa de existir no filesystem.

## Risco

Mínimo. São 2 arquivos `index.ts` de roteamento padrão do Supabase, sem lógica de negócio. Reversível em 10 segundos.

## O que NÃO vou fazer

- Não vou tocar em nenhuma function de IA
- Não vou mudar o `command:` do compose
- Não vou mexer em env vars
- Não vou usar rsync com `--delete` de novo

## Próximo passo

Quando aprovar:
1. Volto em modo default
2. Te entrego um **bloco único** com os 2 heredocs (`main/index.ts` + `hello/index.ts`) + restart + validação
3. Você cola, testa as IAs, me dá o veredito final
4. Eu atualizo `mem://infra/deploy-workflow` com a regra "nunca usar rsync --delete no volume de functions"

