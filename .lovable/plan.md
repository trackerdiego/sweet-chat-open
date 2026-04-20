

# Reavaliação: causa raiz NÃO é variável de ambiente

## O que mudou no diagnóstico

O printenv da Fase A provou que **todas as variáveis obrigatórias do runtime já estão dentro do container**:

```
JWT_SECRET=<set>
SUPABASE_ANON_KEY=<set>
SUPABASE_DB_URL=<set>
SUPABASE_PUBLIC_URL=<set>
SUPABASE_PUBLISHABLE_KEYS=<set>
SUPABASE_SECRET_KEYS=<set>
SUPABASE_SERVICE_ROLE_KEY=<set>
SUPABASE_URL=<set>
VERIFY_JWT=<set>
GOOGLE_GEMINI_API_KEY=<set>  (visto na rodada anterior)
```

Ou seja: H2 (secret faltando) está **descartada**. A mensagem `[Error] Missing required environment variables` que aparece 51× nos logs **não é do edge-runtime base** — é do **nosso próprio código** dentro de uma das edge functions, que checa env vars na inicialização e loga essa frase exata quando algo falta no escopo dele.

## Nova hipótese (alta confiança)

Existe uma function nossa (provavelmente `auth-email-hook` ou `process-email-queue`, dado o `RESEND_API_KEY` que aparece como "not set" nos warnings do compose) que faz algo do tipo:

```ts
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
if (!RESEND_API_KEY) {
  console.error("[Error] Missing required environment variables");
  // throw ou return 500
}
```

Como o edge-runtime do Supabase carrega **todas** as functions no boot quando uma é invocada, **uma function que falha no boot pode derrubar o pool inteiro** — o que faria o sintoma "todas as funções de IA falham" sem que as functions de IA tenham qualquer bug.

Os WARN do compose confirmam: `RESEND_API_KEY` está ausente do `.env` da VPS.

## Plano de correção em 3 passos

### Passo 1 — Identificar exatamente qual function loga a frase

Comando único de leitura na VPS:

```bash
cd /root/app
grep -rn "Missing required environment variables" supabase/functions/
```

Isso aponta o arquivo e a linha. Aposta forte: `auth-email-hook/index.ts` ou `process-email-queue/index.ts` checando `RESEND_API_KEY`.

### Passo 2 — Confirmar quais env vars o app realmente lê e o que falta

```bash
cd /root/app
grep -rEn "Deno\.env\.get\(" supabase/functions/ | grep -v "//"
```

Lista todas as env vars consumidas. Cruzo com o printenv pra te dizer exatamente o que falta no `.env`.

### Passo 3 — Correção (a definir após o passo 1)

Dois caminhos possíveis, sem mudança de arquitetura:

**Caminho A — adicionar a env faltante (recomendado se a função é usada):**
1. Editar `~/supabase/docker/.env` adicionando `RESEND_API_KEY=<valor>` (ou a que for)
2. Editar `~/supabase/docker/docker-compose.yml` no service `functions` adicionando `RESEND_API_KEY: ${RESEND_API_KEY}` em `environment:`
3. `docker compose up -d --force-recreate functions`

**Caminho B — tornar o check não-fatal (recomendado se a feature está desligada):**
- Patch cirúrgico na function: trocar `throw` / `Deno.exit` por log + early return só dentro do handler. Assim a function continua "viva" no pool sem matar as outras. Não toca nenhuma function de IA.

Vou escolher entre A e B baseado no que o passo 1 revelar e no fato de você usar Resend ou não hoje.

## O que NÃO vou fazer

- Não vou tocar em nenhuma das 3 functions de IA (`generate-script`, `generate-daily-guide`, `generate-tools-content`) — elas estão saudáveis
- Não vou mexer no `.env` sem você confirmar o valor
- Não vou recriar todo o stack
- Não vou mudar arquitetura, schema, frontend ou auth

## Risco

Mínimo. Passos 1 e 2 são leitura pura. Passo 3 é uma linha de env ou um `if` defensivo numa única function não-IA.

## Próximo passo

Quando aprovar, eu volto em modo default e:
1. Te entrego **o bloco único dos passos 1 e 2** pra colar na VPS
2. Você cola a saída
3. Eu identifico o arquivo culpado e te entrego o patch (caminho A ou B) + comando de aplicação

