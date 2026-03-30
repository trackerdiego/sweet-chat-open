
Objetivo: eliminar de vez o erro “Não foi possível ativar as notificações” no iPhone (PWA instalado), com correção estrutural e feedback claro para o usuário.

Diagnóstico (feito no código + banco):
- Do I know what the issue is? Sim.
- O fluxo atual usa `upsert(..., { onConflict: 'endpoint' })` em `push_subscriptions`.
- A tabela `public.push_subscriptions` NÃO tem constraint única em `endpoint` (apenas PK em `id`).
- Isso pode quebrar a inscrição no momento de salvar a assinatura (falha silenciosa para o usuário, caindo no erro genérico).
- Em iPhone/PWA isso aparece como “não foi possível ativar” mesmo quando a permissão foi concedida.

Plano de correção

1) Corrigir o esquema do banco para suportar o upsert atual
- Criar migration para adicionar constraint única em `push_subscriptions.endpoint`.
- Opcional recomendado na mesma migration: índice em `user_id` para leitura/envio mais rápido de pushes por usuário.
- Resultado esperado: `upsert onConflict: 'endpoint'` passa a funcionar de forma determinística.

2) Tornar o hook de push mais robusto (sem depender do timing do SW)
Arquivo: `src/hooks/usePushNotifications.ts`
- Ajustar detecção de suporte para exigir os 3 recursos: `serviceWorker + PushManager + Notification`.
- No `subscribe()`, se `registration` ainda estiver `null`, aguardar `navigator.serviceWorker.ready` antes de falhar.
- Trocar retorno booleano por retorno estruturado (ex.: `{ ok: false, reason: 'permission_denied' | 'sw_not_ready' | 'db_save_failed' | 'not_supported' }`) para mensagens precisas.
- Manter log técnico do erro real do Supabase para diagnóstico futuro.

3) Melhorar mensagem no menu de Config
Arquivo: `src/components/Navigation.tsx`
- Ler o `reason` retornado por `subscribe()`.
- Mensagens específicas:
  - `permission_denied`: orientar a habilitar notificações no iOS/Safari/PWA.
  - `sw_not_ready`: “aguarde 2-3 segundos e tente novamente”.
  - `db_save_failed`: “erro ao salvar dispositivo” (sem genérico).
  - `not_supported`: manter orientação sobre ambiente não suportado.
- Preservar mensagem de preview/iframe já implementada.

4) Validar ponta a ponta no cenário real de venda (iPhone PWA)
Checklist de validação:
- Publicado (não preview), abrir no Safari iPhone.
- Adicionar à tela inicial e abrir pelo ícone (PWA standalone).
- Tocar “Ativar notificações” e aceitar permissão.
- Confirmar criação de linha em `push_subscriptions`.
- Disparar push de teste (`send-push`) para esse `user_id`.
- Confirmar recebimento em background e clique abrindo URL correta.

5) Blindagem adicional (opcional, mas recomendada)
- Se houver erro de persistência, não deixar estado visual “ativado”.
- Exibir “Tentar novamente” com retry leve (1 tentativa) antes de falha final.

Arquivos a alterar
- `supabase/migrations/<nova_migration>.sql` (constraint única em `push_subscriptions.endpoint` + índice em `user_id` opcional)
- `src/hooks/usePushNotifications.ts` (detecção, readiness, retorno com motivo)
- `src/components/Navigation.tsx` (toasts contextuais por motivo)

Detalhes técnicos
- Causa-raiz principal: incompatibilidade entre `onConflict: 'endpoint'` e ausência de `UNIQUE(endpoint)` no banco.
- O problema não é “marketing” ou “produto”: é uma falha técnica objetiva na persistência da subscription.
- Com essa correção, o fluxo volta a ficar estável para iPhone PWA instalado, que é exatamente o cenário comercial que você precisa.
