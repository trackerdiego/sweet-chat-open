
## Corrigir o runtime que ainda está executando código antigo

### Diagnóstico confirmado
- O log `Missing required environment variables` **não existe mais no código atual do repositório**.
- Mesmo assim ele continua aparecendo na VPS.
- Isso indica com alta confiança que o self-hosted está rodando **bundle antigo de edge function** ou **container órfão/stale**, não o source atualizado que foi copiado.

### O que será feito
1. **Identificar a origem exata do log no runtime ativo**
   - Verificar qual function/container ainda emite `Missing required environment variables`
   - Checar se o container órfão `supabase-functions-run-...` ainda existe e está participando da execução
   - Conferir se o código carregado dentro do runtime corresponde ao commit atual

2. **Parar de depender de restart/copy como correção principal**
   - Tratar `docker compose cp + restart` como workaround incompleto
   - Aplicar o caminho oficial deste projeto: **deploy real das edge functions self-hosted**
   - Prioridade inicial: `auth-email-hook` e `process-email-queue`
   - Se necessário, redeployar o conjunto completo listado em `scripts/deploy-selfhost.sh`

3. **Limpar resíduos do runtime antigo**
   - Remover órfãos do compose
   - Garantir que o serviço `functions` suba sem reaproveitar instâncias antigas
   - Validar que só existe um runtime ativo respondendo

4. **Validar as functions de IA após o redeploy**
   - Testar `generate-script`
   - Testar `generate-daily-guide`
   - Testar `generate-tools-content`
   - Confirmar que o erro residual desapareceu dos logs

### Implementação proposta
#### Fase A — confirmação operacional
- Inspecionar:
  - `scripts/deploy-selfhost.sh`
  - lista de functions públicas/privadas
  - presença de órfãos no stack
- Verificar se o projeto depende de **`supabase functions deploy`** para atualizar o bundle real do edge-runtime

#### Fase B — correção principal
- Executar deploy self-hosted das functions alteradas usando o fluxo do projeto
- Limpar órfãos
- Reiniciar o serviço `functions` de forma consistente com o deploy

#### Fase C — validação
- Confirmar ausência do log antigo
- Validar no app os fluxos:
  - `/tasks`
  - `/script`
  - `/tools`
- Se sobrar falha, rastrear por function específica em vez de tratar o pool inteiro

## Resultado esperado
- O runtime deixa de carregar código legado
- O log `Missing required environment variables` desaparece
- As ferramentas de IA voltam a responder no app
- O deploy futuro fica padronizado no fluxo correto do self-hosted

## Detalhes técnicos
- `auth-email-hook` e `process-email-queue` já têm fallback `lovable_email_disabled` no código atual
- Como a string antiga não aparece no repo, o problema mais provável é:
  - bundle antigo ainda servido pelo edge runtime, ou
  - container órfão ainda ativo no projeto docker
- Neste projeto, mudanças de edge function em self-hosted devem seguir o fluxo documentado em:
  - `mem://infra/deploy-workflow.md`
  - `scripts/deploy-selfhost.sh`
- A correção não envolve banco, frontend, RLS ou schema
