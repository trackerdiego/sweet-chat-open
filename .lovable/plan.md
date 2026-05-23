Vou corrigir o pisca/volta para o painel focando no roteamento e nos carregamentos que acontecem ao entrar em `/tarefas`.

Plano:
1. Ajustar o carregamento global de autenticação em `App.tsx` para não renderizar rotas autenticadas antes de `useUserProfile` e `useSubscription` estabilizarem, evitando flash de rota e redirects transitórios.
2. Blindar a página `Tasks.tsx` para respeitar o `loading` real de `useInfluencer/useUserProgress`, além do carregamento das estratégias, mantendo o usuário em `/tarefas` com skeleton enquanto os dados chegam.
3. Revisar os hooks de dados usados em `Tasks` (`useUserProgress`, `useUserStrategies`, `useUserUsage`) para evitar estados iniciais que pareçam “sem acesso/sem dados” e causem renderização instável.
4. Validar no preview o fluxo: login → painel → clique em Tarefas → permanecer em `/tarefas` sem piscar nem retornar para `/`.

Detalhe técnico provável: hoje várias leituras Supabase disparam em paralelo no mount; enquanto uma ainda está carregando, a rota pode renderizar com defaults e depois re-renderizar. Em preview isso fica mais perceptível porque o iframe/dev server troca estado e pode parecer um redirect para o painel.