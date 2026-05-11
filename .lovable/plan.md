Sim — pelo diagnóstico, existe um ajuste que precisa rodar no Supabase self-hosted, porque o frontend está tentando apagar `user_strategies` e `audience_profiles`, mas essas tabelas não têm policy `DELETE` para o usuário autenticado. Com RLS ativo, o delete falha ou não remove nada; daí a matriz antiga continua existindo e o onboarding pode validar como “tudo pronto”.

Plano de correção:

1. Corrigir o reset no frontend
- Tratar explicitamente erro nos deletes em `Navigation.tsx`, em vez de ignorar silenciosamente.
- Limpar também o run salvo no navegador antes de redirecionar.
- Garantir que o redirecionamento para `/onboarding` abra o formulário inicial, não a tela de pipeline/finalização.

2. Corrigir a retomada do onboarding
- Ajustar `useOnboardingRun` para não salvar no localStorage runs que já estão `completed` ou `failed`.
- Quando encontrar run finalizado, limpar `influlab.onboardingRunId` e não ativar pipeline.

3. Entregar SQL obrigatório para o Supabase Studio self-hosted
- Criar policies `DELETE` para o próprio usuário em:
  - `public.user_strategies`
  - `public.audience_profiles`
- Opcionalmente permitir limpar `onboarding_runs` antigos do próprio usuário, ou deixar só o frontend ignorar runs finalizados.

SQL recomendado para rodar no Studio self-hosted:

```sql
create policy if not exists "Users can delete own strategies"
on public.user_strategies
for delete
to authenticated
using (auth.uid() = user_id);

create policy if not exists "Users can delete own audience profile"
on public.audience_profiles
for delete
to authenticated
using (auth.uid() = user_id);
```

4. Se quiser corrigir o usuário atual imediatamente
- Depois das policies, rodar uma limpeza manual para o email afetado, para remover a matriz antiga e forçar o formulário completo.
- Como o Supabase self-hosted não expõe `auth.users` facilmente via frontend, eu entrego o SQL de limpeza usando o `user_id` exato se você me passar, ou usando uma consulta pelo email se o Studio tiver acesso à tabela `auth.users`.

Resultado esperado:
- Ao clicar em “Redefinir matriz”, o app remove a matriz anterior, limpa o perfil de público anterior, zera o estado local e abre a primeira tela do onboarding para preencher nome, descrição do público/negócio e estilo antes de rodar a IA novamente.