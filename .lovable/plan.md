

# Diagnóstico final — outra IA estava errada, problema é outro

## O que os comandos provaram

**Outra IA: ERRADA** ❌
- Volume já está em `/home/deno/functions` (não em `/app/edge-functions` como ela disse)
- Comando do container: `start --main-service /home/deno/functions/main`
- `ls /home/deno/functions` lista todas as 13 functions corretamente
- Ou seja: **o caminho sempre esteve certo**, ela leu errado o seu print

**O que está 100% confirmado funcionando:**
- ✅ Volume montado em `/home/deno/functions` (caminho oficial Supabase)
- ✅ As 2 env vars novas presentes: `EDGE_RUNTIME_PER_REQUEST_DEADLINE_MS=300000` e `EDGE_RUNTIME_WORKER_TIMEOUT_MS=300000`
- ✅ Todas as functions sincronizadas (ai-chat de 16:08 = código novo do dia)
- ✅ Image `supabase/edge-runtime:v1.71.2` rodando

**O que NÃO está mais em jogo:**
- Kong timeout (300s) ✅
- Edge-runtime worker timeout (300s) ✅
- Path do volume ✅
- Código sincronizado ✅
- Promise.all aplicado ✅

## Então por que ainda dava 502/504?

Provavelmente **já não dá mais**. O último teste falho foi ANTES do `--force-recreate` que aplicou as 2 env vars de timeout. Desde então **você não testou de novo**.

A única coisa que falta agora é **rodar o app e ver se ainda quebra**.

## Plano: validar de uma vez por todas

### Passo 1 — Você testa no app (3 min)

No https://app.influlab.pro:
1. Logar
2. **/script** → gerar script → repetir 2x seguidas
3. **/tasks** → abrir guia diário
4. **/tools** → rodar 1 ferramenta IA

Pra cada um: anotar se deu erro (e qual: 502, 504, "demorando muito", JSON inválido) ou se funcionou.

### Passo 2 — Coletar logs da VPS (1 comando)

Logo depois dos testes:

```bash
docker compose logs functions --since 5m 2>&1 \
  | grep -iE "generate-script|generate-daily-guide|generate-tools|gemini responded|db parallel|latency|error|deadline|killed|abort" \
  | tail -80
```

Isso me mostra a latência exata de cada etapa (graças aos `console.log` que já adicionei nas 3 functions).

### Passo 3 — Me reporta

Cola aqui:
- Resultado de cada um dos 4 testes (✅ ou ❌ + qual erro)
- Output do comando de log

Com isso eu fecho o ciclo: ou confirma que está resolvido (atualizo memória), ou identifico exatamente qual camada ainda está estourando (Gemini, DB, ou outro).

## O que NÃO fazer

- **Não aplique a sugestão da outra IA** de mexer no caminho do volume. O caminho atual (`/home/deno/functions`) é o **oficial e correto**. Mexer vai derrubar tudo.
- Não rode mais comandos de patch na VPS — está tudo aplicado.
- Não restart, não recreate. Só testar.

## Próximo passo (após sua aprovação)

Você roda os passos 1+2 acima e me cola o resultado. Com base nisso:
- Se tudo funcionar → atualizo `mem://infra/deploy-workflow.md` com a regra dos 3 timeouts (Kong + 2 edge-runtime) e fechamos.
- Se ainda quebrar → leio os logs do passo 2 e digo exatamente o que ainda precisa.

