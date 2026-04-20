

# Validação final + diagnóstico se ainda falhar

## Status atual

O deploy foi aplicado com sucesso na VPS:
- ✅ `git pull` trouxe commit `16dabcf` ("Corrigiu fallback no email hook")
- ✅ Os 2 arquivos contêm o fix (`lovable_email_disabled`)
- ✅ Código novo foi copiado pra dentro do container
- ✅ Container reiniciado

O log do passo 4 saiu **vazio** (nenhuma linha com `missing required|booted|error`), o que é exatamente o que queríamos: **o erro 51× sumiu**. O container foi reiniciado limpo.

## Próximo passo: validar no app + bloco de diagnóstico se travar

### Bloco 1 — Validação rápida no navegador

Logado como `agentevendeagente@gmail.com`, em **aba anônima, cache limpo**:

1. `/tasks` → clicar "Gerar com IA" em qualquer tarefa
2. `/script` → gerar variação de roteiro de qualquer dia
3. `/tools` → usar qualquer ferramenta de IA
4. `/` → "Gerar sugestões com IA" no Guia do Dia

### Bloco 2 — Se QUALQUER uma falhar, cole na VPS

```bash
cd ~/supabase/docker

# Logs gerais das últimas requisições às functions
docker compose logs functions --tail 200 2>&1 | tail -80

# Filtra erros específicos das 3 functions de IA
docker compose logs functions --tail 300 2>&1 \
  | grep -iE "generate-script|generate-daily-guide|generate-tools-content|gemini" \
  | tail -40
```

Cole o output completo aqui. Com isso eu identifico em segundos qual é o ponto de falha real (se houver).

### Bloco 3 — Se TUDO funcionar

Me avisa "funcionou" e eu fecho o ciclo:
1. Atualizo a memória do projeto registrando esse fix como referência futura
2. Documento no `mem://infra/deploy-workflow` que `docker compose cp + restart` é o caminho válido pra hotfix de edge function sem rebuild

## Cenários possíveis após validação

| Resultado | Diagnóstico | Ação |
|---|---|---|
| Tudo funciona | Pool estabilizou | Fim. Documenta na memória. |
| Só 1 das 3 IAs falha | Bug específico daquela function | Leio logs daquela function, patch cirúrgico |
| Todas as 3 ainda falham | Container não recarregou o código copiado | `docker compose down functions && docker compose up -d functions` |
| Erro de auth (401/403) | Token JWT do frontend não chega na function | Inspeciono `Navigation.tsx`/cliente Supabase |

## O que NÃO vou fazer agora

- Não vou tocar em nenhum arquivo de IA preventivamente
- Não vou mudar `.env` da VPS
- Não vou recriar todo o stack
- Não vou propor rollback enquanto não tiver evidência de regressão

## Próximo passo (após sua aprovação)

1. Volto em modo default
2. Te entrego os Blocos 1 e 2 prontos pra colar
3. Aguardo sua resposta com "funcionou" OU com o output dos logs
4. Ato apropriadamente conforme a tabela acima

