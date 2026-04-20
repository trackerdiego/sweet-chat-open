
User reporta: depois da migração pro self-hosted, as push notifications estão disparando ~20x/dia em intervalos curtos. Preciso investigar o que está agendando os pushes.

Componentes envolvidos:
1. `supabase/functions/scheduled-push/index.ts` — invocada por cron a cada 15 min (vide `MIGRATION-FUNCTIONS.md`)
2. `supabase/functions/send-push/index.ts` — envia push
3. Cron no self-hosted: `cron.schedule('scheduled-push-15min', '*/15 * * * *', ...)`
4. Tabela de regras de agendamento (provável `push_schedules` ou similar)

Vou ler o código pra mapear exatamente a lógica.
