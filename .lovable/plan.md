

# Diagnóstico geral e correção conservadora das funções de IA

## Resumo do problema

Mesmo após os hotfixes anteriores, **todas as abas que dependem de IA** (Tarefas, Script, Ferramentas, possivelmente Chat e Matrix) continuam falhando para você logado como `agentevendeagente@gmail.com`, em aba anônima, cache limpo. Isso indica que o problema **não é cache nem sessão** — é estrutural no caminho até `api.influlab.pro` ou nas edge functions self-hosted.

Você quer:
1. Voltar ao estado fluido anterior
2. Sem mudanças radicais
3. Receber um plano + comandos prontos pra rodar na VPS

## Hipóteses prováveis (em ordem de probabilidade)

Baseado no histórico, na arquitetura self-hosted documentada na memória, e no fato de **todas** as funções de IA estarem quebradas ao mesmo tempo:

### H1 — Código novo nunca chegou na VPS (mais provável)
Lovable edita o repo do GitHub, mas se o `git pull` ou o `./scripts/deploy-selfhost.sh` não rodou na VPS, o container continua servindo o código antigo já com bugs acumulados de deploys anteriores. Você confirmou que o frontend é Vercel (auto-deploy), mas as functions exigem ação manual.

### H2 — Secret `GOOGLE_GEMINI_API_KEY` não está no container `functions`
Memória do projeto avisa: no self-hosted **não basta** colocar a chave em `~/supabase/docker/.env`. Precisa também adicionar `GOOGLE_GEMINI_API_KEY: ${GOOGLE_GEMINI_API_KEY}` na seção `environment:` do service `functions` em `docker-compose.yml` e rodar `docker compose up -d --force-recreate functions`. Se isso foi perdido em algum restart, **todas** as funções de IA quebram juntas — exatamente o sintoma atual.

### H3 — Quota / billing do Google Gemini estourou
Se a chave esgotou créditos ou bateu em rate limit de projeto, todas as funções retornam erro ao mesmo tempo.

### H4 — Container `functions` em estado ruim
Restart parcial, OOM, ou Deno cache corrompido. Resolve com recriação completa.

## Plano de revisão (sem mudar arquitetura)

### Fase 1 — Diagnóstico remoto (você roda, me devolve output)

Vou te entregar **um único bloco de diagnóstico** que coleta tudo que preciso pra confirmar a causa raiz, sem alterar nada:

```bash
# === DIAGNÓSTICO INFLULAB — só leitura, não muda nada ===

# 1. Confirma estado do repo na VPS
cd /root/app && git log --oneline -5 && git status

# 2. Confirma se a chave Gemini está visível DENTRO do container functions
cd ~/supabase/docker
docker compose exec functions printenv | grep -E "GEMINI|LOVABLE_API|SUPABASE_URL" | sed 's/=.*/=<set>/'

# 3. Últimos 80 logs do container functions filtrando os 3 endpoints quebrados
docker compose logs functions --tail 200 2>&1 | grep -E "generate-script|generate-daily-guide|generate-tools-content|GEMINI|error" | tail -80

# 4. Testa a chave Gemini direto, sem passar pelo Supabase
source ~/supabase/docker/.env
curl -s -o /dev/null -w "Gemini direct status: %{http_code}\n" \
  -X POST "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" \
  -H "Authorization: Bearer ${GOOGLE_GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"ping"}]}'

# 5. Confirma se docker-compose.yml expõe a chave pro container functions
grep -A 30 "functions:" ~/supabase/docker/docker-compose.yml | grep -E "GEMINI|environment" | head -20
```

Com a saída desses 5 comandos eu confirmo qual das 4 hipóteses é a real, sem chute.

### Fase 2 — Correção alvo única (depende do diagnóstico)

Cada hipótese tem um caminho de correção diferente, **todos não-invasivos**:

| Hipótese confirmada | Ação na VPS |
|---|---|
| H1 (código antigo) | `git pull origin main` + `./scripts/deploy-selfhost.sh` |
| H2 (secret faltando no container) | Editar `docker-compose.yml` adicionando `GOOGLE_GEMINI_API_KEY: ${GOOGLE_GEMINI_API_KEY}` no service `functions` + `docker compose up -d --force-recreate functions` |
| H3 (quota Gemini) | Renovar billing no Google AI Studio, sem mexer em código |
| H4 (container ruim) | `docker compose down functions && docker compose up -d functions` |

Vou te entregar **o bloco exato** assim que você me devolver a saída do diagnóstico.

### Fase 3 — Reverter pra versão estável se nada resolver (plano B seguro)

Se mesmo com diagnóstico + correção a IA não voltar, vou usar a memória do projeto pra **identificar o último commit conhecido como funcional** e te dar o comando de rollback:

```bash
cd /root/app
git log --oneline | head -20      # você escolhe o SHA estável
git checkout <sha-estavel> -- supabase/functions/generate-script supabase/functions/generate-daily-guide supabase/functions/generate-tools-content
./scripts/deploy-selfhost.sh
```

Isso reverte **só as 3 functions de IA** pro estado validado, sem tocar em frontend, banco, auth ou pagamentos.

## O que NÃO vou fazer

- Não vou refatorar arquitetura
- Não vou trocar provedor de IA
- Não vou criar tabelas novas
- Não vou mexer em onboarding, matrix, chat, push, asaas
- Não vou mudar o frontend nessa rodada
- Não vou aplicar fixes "por cima" sem antes confirmar a causa real

## Fluxo combinado

```text
Você roda bloco de diagnóstico
        │
        ▼
Me manda a saída (cola aqui)
        │
        ▼
Confirmo qual hipótese é (H1/H2/H3/H4)
        │
        ▼
Te entrego bloco único de correção
        │
        ▼
Você roda na VPS
        │
        ▼
Testa /tarefas, /script, /tools logado
        │
        ▼
Se voltou ao normal → fim
Se não → Fase 3 (rollback cirúrgico)
```

## O que aprovar

Quando você aprovar este plano:
1. Volto em modo default
2. Não vou alterar arquivos ainda
3. Vou fechar a resposta com o **bloco de diagnóstico exato** acima, formatado pra você colar direto no terminal da VPS
4. Aguardo a saída pra dar o próximo passo certo

