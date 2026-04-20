

## Fluxo de trabalho definitivo

A partir de agora, sempre que eu fizer qualquer mudança no código aqui no Lovable, vou te entregar **um bloco único de comandos prontos pra colar no terminal da sua VPS**. Esse bloco vai cobrir tudo que precisa acontecer pro app em `app.influlab.pro` refletir a mudança.

## Como o sistema se conecta

```text
┌──────────┐  edita   ┌──────────┐  push auto  ┌────────┐
│ Lovable  │ ───────► │  código  │ ──────────► │ GitHub │
└──────────┘          └──────────┘             └───┬────┘
                                                   │ git pull (manual na VPS)
                                                   ▼
                                            ┌─────────────┐
                                            │ VPS / self  │
                                            │  hosted     │
                                            └──────┬──────┘
                                                   │
                            ┌──────────────────────┼──────────────────────┐
                            ▼                                             ▼
                ┌────────────────────────┐                   ┌──────────────────────────┐
                │ Frontend (Vite build)  │                   │ Edge Functions (Deno)    │
                │ → buildado e servido   │                   │ → deploy via script ou   │
                │   pelo Nginx/host      │                   │   restart do container   │
                └────────────────────────┘                   └──────────────────────────┘
```

Pontos-chave que mudam o comando que vou te passar:

1. **Mudança só de frontend** (componentes React, páginas, estilos): precisa `git pull` + rebuild do frontend.
2. **Mudança só em edge function**: precisa `git pull` + redeploy da function (script ou CLI).
3. **Mudança em frontend + edge function** (caso mais comum): precisa as duas coisas.
4. **Mudança em SQL/schema**: vou te entregar o SQL pra rodar no **SQL Editor do Studio self-hosted**, porque migrations do Lovable não chegam na sua VPS.

## Modelo de bloco que vou te enviar a cada mudança

Sempre vou fechar minha resposta com um bloco assim, adaptado ao tipo de mudança:

### Quando mudar apenas edge functions

```bash
# 1. Atualiza repositório local da VPS
cd ~/influlab-app && git pull origin main

# 2. Redeploy das functions afetadas
cd ~/influlab-app
export SUPABASE_ACCESS_TOKEN=<seu-token>
export PROJECT_REF=<ref-self-hosted>
supabase functions deploy generate-script
supabase functions deploy generate-daily-guide
supabase functions deploy generate-tools-content

# 3. (Fallback) Se preferir restart do container ao invés de deploy CLI:
cd ~/supabase/docker && docker compose restart functions
```

### Quando mudar apenas frontend

```bash
cd ~/influlab-app && git pull origin main
bun install            # ou npm install, conforme sua VPS
bun run build          # gera /dist
# recarrega o Nginx se necessário:
sudo systemctl reload nginx
```

### Quando mudar frontend + edge function (caso típico)

Vou te entregar os dois blocos juntos, em ordem:
1. `git pull`
2. deploy das functions
3. build do frontend
4. reload do Nginx

### Quando houver SQL

Vou destacar separadamente:
```sql
-- Cole no SQL Editor do Studio self-hosted (https://studio.api.influlab.pro)
-- (SQL específico aqui)
```

## O que preciso confirmar com você antes de operar nesse modo

Pra eu te entregar o bloco **certo na primeira vez**, sem chute, preciso confirmar 4 coisas da sua VPS:

1. **Caminho do repositório clonado na VPS** — assumi `~/influlab-app`. Se for outro (ex: `/var/www/influlab`, `/root/app`), me confirma.
2. **Como o frontend é servido** — Nginx servindo `/dist` estático? Outro processo? Isso muda o passo final (`reload nginx` vs outro comando).
3. **Método preferido de deploy de functions** — `supabase functions deploy` (precisa Docker + CLI logado) ou `docker compose restart functions` (mais simples, só reinicia o runtime que lê o código novo do volume)?
4. **Branch que a VPS acompanha** — `main`? `production`? Outra?

Vou usar `questions--ask_questions` agora pra capturar isso de forma estruturada (no próximo turno em modo default).

## Resultado esperado

A partir do alinhamento dessas 4 respostas:
- toda resposta minha que envolver mudança de código termina com **um bloco copia-e-cola pronto**
- você não precisa mais lembrar quais functions deployar nem se precisa rebuild
- o ciclo Lovable → GitHub → VPS → produção vira previsível
- erros de "achei que tinha subido" desaparecem

## O que eu não faço nesse modo

- Não acesso sua VPS diretamente (não tenho SSH).
- Não consigo verificar se o `git pull` deu certo — você que confirma e me devolve o output se algo falhar.
- Não opero no Studio self-hosted — SQL eu te entrego, você cola.

## Próximo passo

Quando você aprovar este plano, eu volto em modo default e:
1. Faço as 4 perguntas via `ask_questions` pra fechar os detalhes da sua VPS.
2. Salvo as respostas na memória do projeto (`mem://infra/deploy-workflow`) pra eu nunca mais te perguntar de novo.
3. A partir daí, todo PR meu termina com o bloco de deploy pronto.

