## Problema

O log da VPS mostra:
```
serving the request with /home/deno/functions/admin-launch-health
worker boot error: failed to bootstrap runtime: could not find an appropriate entrypoint
```

Tradução: o Kong já roteia pra `admin-launch-health`, ou seja, a pasta existe em `~/supabase/docker/volumes/functions/admin-launch-health/` no host. Mas o runtime do edge não acha o `index.ts` lá dentro — pasta vazia ou arquivo não foi copiado.

**Causa raiz**: o `scripts/deploy-selfhost.sh` tem listas hardcoded `PUBLIC_FNS` e `PRIVATE_FNS` que **não incluem** as 2 functions novas (`admin-launch-health`, `admin-reprocess-asaas-event`). Mesmo passando como argumento, em algum momento a pasta foi criada vazia no destino (provavelmente no primeiro `restart` antes do `cp` terminar, ou tentativa parcial).

## O que vou fazer

### 1. Adicionar as 2 functions novas ao script de deploy

Editar `scripts/deploy-selfhost.sh`, array `PRIVATE_FNS`, somando:
- `admin-launch-health`
- `admin-reprocess-asaas-event`

Assim, qualquer `./scripts/deploy-selfhost.sh` (sem argumentos) já inclui elas, e elas viram parte da auditoria automática.

### 2. Bloco de recuperação na VPS (copiar e colar)

Vou te entregar um bloco que:

a) **Confirma** que o `index.ts` está faltando no destino:
```bash
ls -la ~/supabase/docker/volumes/functions/admin-launch-health/ \
        ~/supabase/docker/volumes/functions/admin-reprocess-asaas-event/
```

b) **Re-sincroniza limpo** a partir do `/root/app` (que já está atualizado pelo `git pull`):
```bash
cd /root/app && git pull origin main
rm -rf ~/supabase/docker/volumes/functions/admin-launch-health \
       ~/supabase/docker/volumes/functions/admin-reprocess-asaas-event
./scripts/deploy-selfhost.sh admin-launch-health admin-reprocess-asaas-event
```

c) **Valida** que voltaram funcionando:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS \
  https://api.influlab.pro/functions/v1/admin-launch-health
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS \
  https://api.influlab.pro/functions/v1/admin-reprocess-asaas-event
docker logs supabase-edge-functions --tail 30 | grep -i "boot\|admin-launch"
```

Esperado: `200` em ambos OPTIONS e zero `worker boot error`.

### 3. Testar no app

Recarregar `app.influlab.pro/admin` → aba **Launch Health** → cards aparecem com MRR, webhooks, AI jobs e onboarding.

## Por que essa abordagem é segura

- **Não muda a lógica** das 2 functions — elas estão corretas (são código simples sem upstream).
- **Mantém compatibilidade** com o resto do script (só acrescenta nomes ao array).
- **Limpa o destino** antes de copiar pra eliminar qualquer estado parcial.
- **Validação CORS** já é feita pelo próprio script depois do restart.

## Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `scripts/deploy-selfhost.sh` | +2 linhas no array `PRIVATE_FNS` |

Zero mudança em function, zero mudança em frontend, zero migration. Só script de deploy + bloco de recuperação na VPS.

## Riscos

- **Risco**: se o `git pull` ainda não tiver chegado no `/root/app` (porque a Lovable ainda não comitou esta mudança no `deploy-selfhost.sh`), os arrays continuam antigos no destino.
  - **Mitigação**: o bloco da VPS já roda `git pull` antes do deploy, e o `cp -a` funciona via argumento mesmo com array antigo. Os arrays são só pra "deploy completo" futuro.

- **Risco**: o `rm -rf` apaga as pastas no volume — se outra coisa estiver dependendo, quebra.
  - **Mitigação**: nada mais depende dessas pastas (são novas, criadas só hoje), e o `cp -a` logo em seguida recria com conteúdo correto.

Quando aprovar, eu já edito o script e te mando a resposta com o bloco final pra colar na VPS.