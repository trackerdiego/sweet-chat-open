

# Plano: corrigir o `docker-compose.yml` quebrado da VPS e finalizar o deploy

## Diagnóstico exato

O parser apontou linha 97 e a saída confirma 3 problemas no service **kong** (não no `functions`):

### Problema 1 — `depends_on` duplicado (linhas 28-32)
```yaml
    depends_on:
      analytics:
        condition: service_healthy
    depends_on:           ← duplicado, YAML inválido
      studio:
        condition: service_healthy
```
Uma chave `depends_on` sobrescreve a outra silenciosamente em alguns parsers, mas combinada com o erro 3 quebra tudo.

### Problema 2 — indentação errada de `environment:` (linha ~97)
```yaml
    volumes:
      - ./volumes/api/kong.yml:/home/kong/temp.yml:ro,z
      ...

   environment:        ← TRÊS espaços em vez de QUATRO
      KONG_DATABASE: "off"
```
Esse é literalmente o erro `did not find expected key` na linha 97. YAML é sensível a espaço — `environment:` precisa ficar no mesmo nível de `volumes:` (4 espaços).

### Problema 3 — filhos de `environment:` com indentação errada
Os filhos estão com 6 espaços a partir de uma chave de 3 espaços. Após corrigir o pai para 4 espaços, os filhos precisam de 6 (mantém-se) — ok, mas vale revisar.

## Correção que vou te entregar

Vou produzir o **bloco corrigido exato** das linhas 28-100 para você colar por cima na VPS, com:

1. Um único `depends_on` mesclando `analytics` + `studio`
2. `environment:` com indentação certa (4 espaços, alinhado com `volumes:`)
3. Filhos do `environment:` com 6 espaços consistentes

Você só vai precisar:
- abrir o arquivo: `nano /root/supabase/docker/docker-compose.yml`
- substituir as linhas 28-100 pelo bloco que vou te dar
- validar antes de subir: `cd /root/supabase/docker && docker compose config -q && echo OK`
- recriar o container das functions: `docker compose up -d --force-recreate functions`
- validar a publicação: `curl -sI -X OPTIONS https://api.influlab.pro/functions/v1/start-onboarding-run | grep -i x-influlab-function-version`

## Hardening do `scripts/deploy-selfhost.sh`

Para evitar repetir esse vexame, vou adicionar no script:

1. **Pré-check de YAML antes do restart**:
   ```bash
   if ! (cd "$STACK" && $DC config -q) 2>/dev/null; then
     echo "❌ docker-compose.yml inválido em $STACK."
     echo "   Rode:  cd $STACK && docker compose config"
     echo "   Para ver a linha exata do erro de indentação."
     exit 1
   fi
   ```
   Falha cedo, com mensagem clara apontando o arquivo.

2. **Fallback automático** `restart` → `up -d --force-recreate functions` se o `restart` falhar mas o YAML estiver OK.

3. **Mensagem orientada** quando o validador final não achar `x-influlab-function-version`, sugerindo:
   - `docker logs supabase-edge-functions --tail 50`
   - `docker ps | grep functions`

## Atualização no `MIGRATION-FUNCTIONS.md`

Adicionar seção curta **"docker-compose.yml quebrou — diagnóstico rápido"** com:
- como identificar a linha do erro (`docker compose config`)
- as 3 pegadinhas mais comuns (indentação de `environment:`, `depends_on` duplicado, mistura tab/espaço)

## Arquivos que vou alterar no repo

- `scripts/deploy-selfhost.sh` — pré-check de YAML + fallback de restart + mensagens orientadas
- `MIGRATION-FUNCTIONS.md` — seção de diagnóstico de YAML quebrado

## Arquivos que NÃO vou alterar

- Frontend e edge functions — corretos, já no volume da VPS
- Schema do banco — `onboarding_runs` já criada
- O próprio `docker-compose.yml` da VPS — não vive no repo, vou te entregar o snippet pra você colar

## Resultado esperado

Depois desse ciclo:
1. Você cola o snippet corrigido no `docker-compose.yml` da VPS
2. `docker compose config -q` passa sem erro
3. `docker compose up -d --force-recreate functions` recria o container com o código novo
4. `curl` em `start-onboarding-run` retorna `x-influlab-function-version`
5. Onboarding assíncrono entra em produção
6. Próximos deploys param de quebrar feio porque o script valida o YAML antes de tentar restart

