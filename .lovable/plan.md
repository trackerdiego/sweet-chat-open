## Contexto
O projeto usa Supabase self-hosted (`api.influlab.pro`) como backend principal, mas mantém um projeto Supabase Cloud ativo (ref `gchncrlrmsyzumgmbplh`). Sem uso periódico, o projeto Cloud pode ser pausado pela plataforma.

## Objetivo
Adicionar um cron job no VPS self-hosted que pinga o Supabase Cloud periodicamente, evitando pausa por inatividade.

## Plano

### 1. Criar edge function de keep-alive no projeto
Criar `supabase/functions/keep-alive/index.ts` — uma function mínima que responde `200 OK` em milissegundos. Isso evita depender de functions mais pesadas (como `get-ai-job-status`) que podem falhar ou gerar logs de erro desnecessários.

### 2. Adicionar function à lista de deploy
Incluir `keep-alive` no array `PUBLIC_FNS` de `scripts/deploy-selfhost.sh` para que seja publicada no self-hosted (não obrigatório pro ping Cloud, mas mantém consistência).

### 3. Documentar comando cron
Adicionar seção no `scripts/deploy-selfhost.sh` com o comando exato a ser inserido no crontab do root no VPS:

```
# manter Supabase Cloud ativo — ping a cada 5 dias
0 0 */5 * * curl -fsS -o /dev/null "https://gchncrlrmsyzumgmbplh.supabase.co/functions/v1/keep-alive" -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjaG5jcmxybXN5enVtZ21icGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjQ1NDksImV4cCI6MjA5MDQwMDU0OX0.oAXmnjsdcnNPEBq76s2236_J_fKFNtjUnrQFX8JeQ_I"
```

### 4. Instruções de aplicação no VPS
Após o merge, o usuário deve rodar uma única vez no VPS:

```bash
(crontab -l 2>/dev/null; echo "0 0 */5 * * curl -fsS -o /dev/null \"https://gchncrlrmsyzumgmbplh.supabase.co/functions/v1/keep-alive\" -H \"apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjaG5jcmxybXN5enVtZ21icGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjQ1NDksImV4cCI6MjA5MDQwMDU0OX0.oAXmnjsdcnNPEBq76s2236_J_fKFNtjUnrQFX8JeQ_I\"") | crontab -
```

---

**Nota técnica:** A function `keep-alive` deve ser publicada no Supabase Cloud (via painel ou CLI direto no Cloud) para que o endpoint exista. O deploy-selfhost.sh publica no self-hosted; o Cloud já tem o projeto vinculado no Lovable, então basta criar o arquivo no repo que o Lovable faz o deploy pro Cloud automaticamente.