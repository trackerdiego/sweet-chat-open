## Diagnóstico

O problema ainda não está no cache nem no SQL isoladamente. A navegação depende de `user_profiles.onboarding_completed`, mas a atualização desse estado no frontend fica presa em três riscos:

1. `AppRoutes` só decide entre `/onboarding` e app normal usando o perfil carregado no primeiro fetch.
2. Depois que o onboarding em background termina, a tela faz `window.location.replace('/')` antes de forçar uma nova leitura do perfil.
3. A rota `/onboarding` continua acessível mesmo quando `onboarding_completed=true`, então um run antigo/completo ou uma atualização atrasada pode produzir ida para tela errada, e o app pode cair em `/matriz`/app com dados antigos.

## Plano de correção

1. **Adicionar sincronização explícita do perfil**
   - Expor um `refreshProfile()` no `useUserProfile` para reler `user_profiles` sob demanda.
   - Evitar depender apenas do estado inicial do hook após reset ou conclusão do onboarding.

2. **Bloquear rota `/onboarding` quando não deve processar automaticamente**
   - No `AppRoutes`, tratar `/onboarding` de forma controlada:
     - Se `needsOnboarding=true`, mostrar onboarding.
     - Se `needsOnboarding=false`, não deixar onboarding antigo disparar fluxo/pipeline por acidente; redirecionar para `/`.
   - Isso impede que apagar `/onboarding` da URL e dar refresh entre estados cause pulos inconsistentes.

3. **Após reset de matriz, limpar estado local e aguardar banco confirmar**
   - Em `Navigation.tsx`, depois de marcar `onboarding_completed=false`, invalidar/remover qualquer run local antigo.
   - Redirecionar para `/onboarding` só após a atualização do perfil retornar sucesso.

4. **Após onboarding terminar, atualizar perfil antes de sair da tela**
   - Em `Onboarding.tsx`, quando `run.status === 'completed' && matrixValidated`, limpar run local e navegar para `/` somente depois de uma nova leitura do perfil confirmar `onboarding_completed=true`.
   - Trocar `window.location.replace` por navegação controlada quando possível para evitar corrida com estado antigo.

5. **Entregar SQL de auditoria/correção para o self-hosted**
   - Como o backend é self-hosted, incluir um bloco SQL para verificar exatamente o usuário `agentevendeagente@gmail.com`: perfil, `onboarding_completed`, descrição, matriz e runs recentes.
   - Incluir SQL opcional de reset limpo caso o banco ainda esteja inconsistente.

## Arquivos previstos

- `src/hooks/useUserProfile.ts`
- `src/App.tsx`
- `src/pages/Onboarding.tsx`
- `src/components/Navigation.tsx`

## Resultado esperado

- Ao acessar `/` com onboarding pendente, vai para `/onboarding` e fica no formulário.
- Ao remover `/onboarding` da URL enquanto ainda está pendente, o app volta para `/onboarding` corretamente, sem pular para final ou matriz.
- Ao concluir o onboarding, só entra no app depois de confirmar perfil e matriz válidos.
- Ao resetar matriz, não reaproveita run antigo nem estado local antigo.