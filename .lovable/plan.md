

# Plano: criar memória "Self-hosted Timeout Survival Guide"

## O que vou criar

Um único arquivo de memória — `mem://infra/selfhost-timeout-debugging.md` — que serve como playbook de diagnóstico quando "edge function falha sem motivo aparente" voltar a acontecer. Mais uma linha no `mem://index.md` apontando pra ele.

## Conteúdo do arquivo (resumo do que vai ter)

### 1. Lição central
O problema NÃO era o Gemini. Era **timeout em camadas do self-hosted** (Cloudflare 100s → Nginx → Kong → edge runtime) matando requests longos antes do Gemini responder. O retorno chegava como 503/502/504 e parecia "API instável", mas era infra cortando a conexão.

### 2. Comparativo: antes vs depois

| Aspecto | Lovable Cloud (antes) | Supabase Self-hosted (hoje) |
|---|---|---|
| Edge runtime timeout | 150s gerenciado | 60s default Kong + 100s Cloudflare |
| Healthcheck do gateway | Gerenciado, invisível | `kong health` com `start_period: 0s` por default → cadeia toda quebra no boot |
| Secrets em functions | UI Lovable, hot reload | Edit `.env` + `docker-compose.yml` + `--force-recreate` |
| Recuperação após reboot | Automática | Manual se algum container falha healthcheck |
| Logs | Painel Lovable | `docker logs` + `supabase--analytics_query` |
| Deploy | Automático no push | `./scripts/deploy-selfhost.sh` na VPS |

### 3. Por que mudar gerou os problemas
- Requests síncronos longos (onboarding 60-90s) batiam no timeout do Kong/Cloudflare
- Container `functions` depende de `kong: service_healthy`; se Kong demora >5s pra ficar healthy no boot, `functions` recusa subir
- Sem `start_period` no healthcheck, qualquer reboot da VPS = quebra em cascata
- Erros do tipo "503 Gemini" mascaravam timeouts reais da infra (o erro chegava DEPOIS do Kong cortar a conexão upstream)

### 4. Sintomas vs causa real (tabela diagnóstica)

| Sintoma no app | Causa provável | Ação |
|---|---|---|
| 502 em `/functions/v1/*` | Container `functions` down | `docker compose ps functions` |
| 503 após exatos ~15s | Timeout Kong/Cloudflare cortando upstream | Verificar `x-kong-proxy-latency` |
| 504 após ~60s | Function rodando >60s síncrono | Refatorar pra job assíncrono |
| Login falhando | Kong unhealthy, auth não roteia | `curl /auth/v1/health` |
| Erro só após VPS reiniciar | Healthcheck sem `start_period` | Adicionar `start_period: 60s` |

### 5. Fórmulas de normalização (passo a passo, em ordem)

**Passo 1 — Triagem de 30s:**
```bash
cd /root/supabase/docker
docker compose ps
curl -i https://api.influlab.pro/auth/v1/health -H "apikey: $ANON"
curl -sI -X OPTIONS https://api.influlab.pro/functions/v1/start-onboarding-run | grep -iE 'http|x-influlab'
```

**Passo 2 — Se algum container down/unhealthy:**
```bash
docker compose up -d --no-deps <nome>
docker logs <container> --tail 50
```

**Passo 3 — Se YAML quebrado:**
```bash
docker compose config -q
# Se erro: cp docker-compose.yml.bak docker-compose.yml e ajustar
```

**Passo 4 — Se functions desatualizadas:**
```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh
```

**Passo 5 — Se erro upstream em function específica:** usar `supabase--edge_function_logs` + `supabase--analytics_query` (function_edge_logs) pra confirmar se é Gemini real ou timeout do gateway.

### 6. Regras pra prevenir recorrência
- Toda function que pode passar de 30s → padrão job assíncrono (modelo `start-onboarding-run`)
- Todo healthcheck com `depends_on: service_healthy` → exigir `start_period >= 60s`
- Toda mudança de secret → `.env` + `docker-compose.yml` environment + `--force-recreate`
- Backup automático do compose ANTES de qualquer edit (`cp docker-compose.yml docker-compose.yml.bak`)

### 7. O que NÃO assumir mais
- "503 = Gemini instável" — quase sempre é timeout de gateway no self-hosted
- "Funcionou ontem, vai funcionar hoje" — reboot sem `start_period` quebra cadeia
- "Migration Lovable resolve" — não chega no self-hosted, sempre SQL manual no Studio

## O que vai mudar no repo

1. **Criar** `.lovable/memory/infra/selfhost-timeout-debugging.md` com o conteúdo acima
2. **Atualizar** `.lovable/memory/index.md` adicionando 1 linha na seção `## Memories` apontando pro novo arquivo (preservando todas as outras linhas existentes)

## O que NÃO vai mudar

- Nenhum código de aplicação
- Nenhuma function
- Nenhuma config de infra (já foi feita nos turnos anteriores)
- Memórias existentes ficam intactas

