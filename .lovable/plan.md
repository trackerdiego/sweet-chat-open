
Objetivo: corrigir de vez o caso em que `agentevendeagente@gmail.com` continua vendo “Limite atingido” mesmo após já estar `is_premium = true` no banco.

O que encontrei
1. O app hoje usa um cliente Supabase hardcoded em `src/integrations/supabase/client.ts`:
   - URL: `https://api.influlab.pro`
   - key hardcoded também
2. O projeto conectado no Lovable/Supabase está configurado com outro endpoint em `.env`:
   - `VITE_SUPABASE_URL="https://gchncrlrmsyzumgmbplh.supabase.co"`
3. O acesso premium em toda a UI depende do hook `useUserUsage()`, que faz:
   - `select('*').eq('user_id', user.id).maybeSingle()`
4. A tabela `user_usage` foi criada sem `UNIQUE(user_id)`, então pode haver mais de uma linha por usuário. Se existir duplicidade, `maybeSingle()` pode falhar ou trazer comportamento inconsistente.
5. O toast da sua captura (“Limite atingido / Assine para continuar”) vem do fluxo do `ScriptGenerator`, que depende diretamente de `canUseScript` vindo de `useUserUsage`.

Plano de implementação
1. Alinhar o cliente Supabase ao projeto conectado
   - Trocar `src/integrations/supabase/client.ts` para usar `import.meta.env.VITE_SUPABASE_URL` e `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`.
   - Isso elimina o risco de o frontend estar lendo premium de um backend diferente daquele onde fizemos o update.

2. Corrigir a integridade de `user_usage`
   - Criar uma migration para:
     - identificar e remover duplicatas por `user_id`, preservando uma linha final correta
     - garantir `UNIQUE(user_id)` na tabela
   - Isso estabiliza o `maybeSingle()` e evita bugs futuros de premium/limites.

3. Tornar `useUserUsage()` mais robusto
   - Refatorar o hook para:
     - lidar melhor com erro de leitura
     - refazer carga quando a sessão mudar
     - opcionalmente expor um `refreshUsage()` para forçar atualização após login/pagamento
   - Se houver erro na leitura, registrar log claro no console para facilitar diagnóstico.

4. Validar os pontos de bloqueio premium
   - Conferir e ajustar os lugares que usam esse hook:
     - `src/components/ScriptGenerator.tsx`
     - `src/pages/Tools.tsx`
     - `src/pages/Matrix.tsx`
     - `src/components/Navigation.tsx`
     - `src/pages/Index.tsx`
   - Garantir que todos dependam do mesmo estado premium já corrigido.

5. Verificação final
   - Testar o fluxo completo com `agentevendeagente@gmail.com`:
     - script sem bloqueio
     - tools sem bloqueio
     - transcrição sem bloqueio
     - matriz dias 8-30 liberada
     - “Redefinir perfil” liberado
     - banner de plano gratuito escondido quando `isPremium = true`

Detalhes técnicos
```text
Hoje, o diagnóstico mais forte é:

Frontend -> client.ts hardcoded -> possível backend/projeto diferente
                          +
user_usage sem UNIQUE(user_id) -> maybeSingle() frágil

Resultado:
o banco pode até estar certo,
mas a UI continua tratando a conta como free.
```

Resultado esperado após a implementação
- `agentevendeagente@gmail.com` passa a ser reconhecido como premium imediatamente no app correto
- todos os gates premium param de abrir checkout para essa conta
- o sistema fica consistente para futuros upgrades premium também
