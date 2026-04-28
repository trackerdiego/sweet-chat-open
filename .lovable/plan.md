## Diagnóstico

O erro que apareceu na tela não é mais timeout da IA. Agora o problema é que o frontend já está chamando as novas funções assíncronas (`start-*-job` e `get-ai-job-status`), mas elas não estão disponíveis/registradas corretamente no backend self-hosted.

Teste direto no `https://api.influlab.pro/functions/v1/...` mostrou:

```text
start-tools-job              -> HTTP 500
start-script-job             -> HTTP 500
start-daily-guide-job        -> HTTP 500
start-transcription-job      -> HTTP 500
get-ai-job-status            -> HTTP 500

corpo do erro:
InvalidWorkerCreation: worker boot error: failed to bootstrap runtime: could not find an appropriate entrypoint
```

As funções antigas ainda respondem `200` no `OPTIONS`, então o stack está vivo. O problema é deploy/registro das funções novas no self-hosted.

Causa provável encontrada no código: `scripts/deploy-selfhost.sh` ainda lista somente as funções antigas. Ele não inclui as 5 novas funções assíncronas em `PRIVATE_FNS`, nem em `VALIDATE_FNS`. Então, ao rodar o deploy padrão na VPS, o script não copia/publica as novas pastas para o volume do Supabase Functions e também não valida se elas entraram no ar.

## Plano de correção

1. Atualizar o script de deploy self-hosted
   - Adicionar em `PRIVATE_FNS`:
     - `start-tools-job`
     - `start-script-job`
     - `start-daily-guide-job`
     - `start-transcription-job`
     - `get-ai-job-status`
   - Adicionar essas 5 também em `VALIDATE_FNS` para o deploy falhar se alguma não estiver publicada.

2. Melhorar a validação pós-deploy
   - Hoje a validação procura header `x-influlab-function-version`, mas as novas funções não retornam esse header.
   - Ajustar para validar pelo `OPTIONS` retornando `2xx` com CORS, ou adicionar header de versão nas respostas das novas funções e validar por ele.
   - Preferência: adicionar `x-influlab-function-version` via `jsonResponse`/CORS das novas funções para diagnóstico ficar claro.

3. Corrigir UX de erro no frontend
   - O SDK mostra mensagem genérica: `Edge Function returned a non-2xx status code`.
   - Ajustar os handlers das chamadas assíncronas para extrair o corpo real do erro quando disponível.
   - Assim, se voltar a falhar, o toast mostra algo útil como “função não publicada”/“não autorizado”/“job não encontrado”, não um erro genérico.

4. Entregar comando exato para VPS
   - Como o backend é self-hosted, após o patch você deve rodar na VPS:

```bash
cd /root/app && git pull origin main
./scripts/deploy-selfhost.sh --force-docker
```

   - Se quiser deploy pontual imediatamente:

```bash
cd /root/app && git pull origin main
./scripts/deploy-selfhost.sh --force-docker
```

   O script atualizado vai copiar também as 5 funções novas e reiniciar o container `functions`.

5. Validação final
   - Testar via `curl`:

```bash
for fn in start-tools-job start-script-job start-daily-guide-job start-transcription-job get-ai-job-status; do
  echo "== $fn =="
  curl -sS -i -X OPTIONS "https://api.influlab.pro/functions/v1/$fn" | head -n 12
done
```

   - Resultado esperado: `HTTP/2 200` ou resposta CORS válida, não `InvalidWorkerCreation`.
   - Depois testar uma chamada real no app: scripts, tools e transcrição devem iniciar job e ficar em processamento até concluir.

## Resultado esperado

Depois do deploy correto, as chamadas de IA não vão mais morrer antes de iniciar. O fluxo fica:

```text
Frontend -> start-*-job -> responde jobId rápido
Frontend -> get-ai-job-status a cada 2s
Worker em background -> chama IA -> salva resultado em ai_jobs
Frontend -> recebe done/failed com mensagem real
```

Isso corrige o erro atual de `Edge Function returned a non-2xx status code` causado por função assíncrona não publicada no self-hosted.