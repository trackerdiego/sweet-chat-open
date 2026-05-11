## Bug crítico: "Redefinir matriz" pula direto para tela final do onboarding

### Causa raiz
Quando o usuário aciona "Redefinir matriz" (`Navigation.handleResetNiche`), apenas dois flags do `user_profiles` são resetados (`onboarding_completed=false`, `description_status='pending'`). Porém:

1. O `localStorage` mantém a chave `influlab.onboardingRunId` do run anterior já concluído.
2. A row em `user_strategies` (matriz de 30 dias) e em `audience_profiles` continua existindo.
3. Ao entrar em `/onboarding`, o `useEffect` chama `resume()` do `useOnboardingRun`, que faz polling no `get-onboarding-run-status` usando o ID antigo.
4. `resume()` retorna o run antigo (`status='completed'`, `matrixValidated=true`) — ver linhas 131-133 do hook.
5. `Onboarding.tsx` faz `setShowPipeline(true)` e o segundo `useEffect` (linha 80-89) detecta `completed + matrixValidated`, exibe o toast "Tudo pronto!" e redireciona pra `/`.
6. Como a matriz ainda existe no banco, AccessGuard libera; nada do formulário é mostrado novamente.

### Correções (mínimas e seguras)

**1. `src/components/Navigation.tsx` — `handleResetNiche`**
Reset completo no client antes de navegar:
- Limpar `localStorage.removeItem('influlab.onboardingRunId')`.
- Apagar a matriz e o perfil de audiência do usuário (`user_strategies` e `audience_profiles`) via `supabase.from(...).delete().eq('user_id', uid)` para garantir que o usuário precise gerar tudo de novo.
- Manter o reset dos dois flags do `user_profiles` que já existe.
- Forçar `window.location.replace('/onboarding')` (em vez de `navigate`) para descartar qualquer state em memória dos hooks.

**2. `src/hooks/useOnboardingRun.ts` — `resume()`**
Nunca retornar runs `completed` automaticamente:
- Remover o bloco `if (res?.run && res.run.status === 'completed' && res.matrixValidated) return res.run;` (linhas 131-133).
- Apenas runs `pending`/`running` devem reativar o pipeline. Run completed = nada a fazer.

**3. `src/pages/Onboarding.tsx` — useEffect de mount (linhas 69-77)**
Defensiva: só ativar `setShowPipeline(true)` quando o status retornado for `pending` ou `running`. Remover `'completed'` da condição.

### O que NÃO mexer
- Edge functions (`start-onboarding-run`, `get-onboarding-run-status`) — backend self-hosted, escopo do bug é frontend puro.
- Trava de integridade do `useUserProfile` — já está correta e ajuda a recuperar usuários presos.
- Schema do banco — sem migration necessária.

### Por que isso resolve no desktop e mobile
Ambos os bugs (localStorage stale + resume retornando completed) são puramente client-side. O fix elimina os dois caminhos que pulavam o formulário.

### Deploy
100% frontend → auto-deploy via Vercel após merge no `main`. Sem mudanças em edge functions ou banco.