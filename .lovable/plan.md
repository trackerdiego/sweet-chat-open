Diagnóstico a partir dos logs:
- O cron está chamando `scheduled-push` corretamente a cada 15 minutos.
- A function está respondendo e classificando o bloco `evening`.
- `Sent: 0, Skipped(dedup): 3` indica que há 3 usuários/assinaturas já marcados em `push_send_log` para esse mesmo bloco/data, então a function não tenta enviar de novo.
- O comando `env | grep VAPID` vazio não explica essa falha, porque o código atual usa VAPID hardcoded em `send-push`, não via env.
- Há um bug provável: `scheduled-push` grava no `push_send_log` antes de confirmar que `send-push` realmente entregou. Se `send-push` falhar ou retornar `sent: 0`, o usuário fica bloqueado por dedup naquele bloco e o log mostra “skipped” nas próximas execuções.

Plano de implementação:
1. Ajustar `scheduled-push` para só registrar `push_send_log` depois de `send-push` retornar `sent > 0`.
2. Se `send-push` retornar `sent: 0`, não criar dedup, permitindo nova tentativa no próximo cron.
3. Melhorar logs de `scheduled-push` com contadores separados: usuários dedupados, tentativas sem assinatura/sem entrega, erros de envio e entregues.
4. Opcionalmente adicionar limpeza de log falso já existente via SQL manual para você rodar no self-hosted, porque migrations Lovable não afetam seu backend.
5. Te entregar também os comandos de VPS para redeploy das edge functions no self-hosted.