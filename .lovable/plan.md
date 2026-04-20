

# VPS atualizada — falta validar e ler os logs corretamente

## O que aconteceu

Tudo aplicou com sucesso:
- ✅ `.env` recebeu as 2 vars
- ✅ `docker-compose.yml` patchado (grep confirmou as 2 linhas no bloco `functions`)
- ✅ Código sincronizado (rsync sem `--delete`)
- ✅ Container recriado (`Started`, não `Restarted` — confirma que pegou env nova)

**O grep do passo 5 voltou vazio** porque o `--since 30s` foi muito apertado: o container subiu em 3.5s, depois você esperou 6s, mas o `main function started` é logado **só na primeira request** (lazy boot do edge-runtime). Sem nenhuma chamada nesse intervalo, não tem o que aparecer no log.

Isso é **esperado**, não é erro.

## Próximo passo: validar de verdade

Em modo default, vou:

### 1. Disparar 1 request real pra `hello` (acorda o pool)
Usando `supabase--curl_edge_functions` → confirma que `main function started` aparece sem `boot error`.

### 2. Disparar `generate-script` com seu JWT (você está logado no preview)
Esse é **o teste que importa**. Com:
- Kong a 300s ✅
- Edge-runtime worker a 300s ✅ (acabou de subir)
- `Promise.all` nas queries ✅
- `max_tokens` controlado ✅

Esperado: **HTTP 200** com o script JSON, latência logada (deve ficar entre 20-90s).

Se vier 200 → resolvido, atualizo memória.
Se vier 502/504 → puxo `supabase--edge_function_logs generate-script` e vejo a latência exata por etapa (`db parallel fetch`, `gemini responded`) pra saber qual camada ainda está estourando.

### 3. Repetir pra `generate-daily-guide` e `generate-tools-content`
Mesma lógica.

## O que você NÃO precisa fazer agora
- Nada na VPS. Já está tudo no lugar.
- Só me confirme que está logado no preview (https://id-preview--ce48c5ee-b61d-4ce0-a218-eb4fa03033e7.lovable.app) com um usuário real, pra eu poder usar o JWT no curl.

## Se algum teste falhar
Plano de contingência (não vou aplicar agora — só se precisar):
- **Se 502 voltar**: olhar log do edge-runtime pra ver se é OOM (memória) — aí precisa de `mem_limit` no compose
- **Se 504 voltar mesmo com Kong 300s**: provavelmente é o **Nginx/Cloudflare na frente do api.influlab.pro** — precisa subir `proxy_read_timeout` lá também
- **Se Gemini der >120s consistente**: aí sim partimos pra fila assíncrona com polling

## Arquivos que vou tocar
Nenhum. Só ferramentas de teste/log.

## Memória a atualizar (se passar)
`mem://infra/deploy-workflow.md` — adicionar:
> Self-hosted exige **3 timeouts de 300s alinhados**: Kong (`kong.yml` rotas `functions-v1`), edge-runtime (`EDGE_RUNTIME_WORKER_TIMEOUT_MS` + `EDGE_RUNTIME_PER_REQUEST_DEADLINE_MS` no compose), e Nginx upstream se houver. Faltar qualquer um = 502/504 em IAs longas.

