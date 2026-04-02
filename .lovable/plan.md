
Objetivo

Parar os falsos positivos de “descrição incompleta” e garantir que, depois de salvar a descrição, o app não volte a regravar o valor antigo.

Diagnóstico

- O bug principal está em `src/hooks/useUserProfile.ts`.
- No `Onboarding.tsx`, a nova descrição é salva primeiro.
- Depois, `finalizeOnboarding()` chama `updateProfile({ onboarding_completed: true })`.
- Hoje `updateProfile` faz `upsert` com fallback do `profile` antigo:
  - `display_name: updates.display_name || profile?.display_name || 'Creator'`
  - `primary_niche: updates.primary_niche || profile?.primary_niche || 'lifestyle'`
- Isso permite que a segunda chamada sobrescreva a descrição recém-salva com a descrição antiga/default. Resultado: o banner continua, o admin mostra status errado e a IA pode seguir usando o texto velho.
- Além disso, a lógica atual está espalhada e conflitante (`length < 80`, `split(' ').length <= 2`), então o app “adivinha” quem está ok em vez de usar um status confiável.

Plano

1. Corrigir a gravação do perfil
- Reescrever `updateProfile` para fazer update parcial, sem reaplicar campos antigos quando o update não envia esses campos.
- Depois de cada save, usar a resposta do banco como fonte de verdade do `profile`.
- Em `Onboarding.tsx`, finalizar o fluxo sem tocar novamente na descrição já salva.

2. Parar de usar heurística de palavras/caracteres
- Criar um campo explícito em `user_profiles`, por exemplo `description_status` com `pending | ok`.
- Esse campo vira a única fonte de verdade para:
  - banner da home
  - status no admin
  - redirecionamento para onboarding
- Remover as regras por caracteres/palavras de `Index.tsx`, `Admin.tsx` e `Onboarding.tsx`.

3. Fazer um backfill seguro dos usuários atuais
- Adicionar a nova coluna via schema migration.
- Rodar um update de dados para preencher:
  - `pending` quando `primary_niche` estiver vazio ou for `lifestyle`
  - `ok` para os demais perfis
- Não vou usar novamente regra de “80+ caracteres” nem “mais de 2 palavras” para reclassificar usuários antigos.
- Para o legado, a lógica vai ser conservadora a favor do usuário: melhor parar de incomodar quem já escreveu algo real do que continuar gerando falso pendente.

4. Alinhar o fluxo futuro
- Novo usuário: `description_status = 'pending'`
- Onboarding concluído com sucesso: `description_status = 'ok'` e `onboarding_completed = true`
- Reset premium: `description_status = 'pending'` e `onboarding_completed = false`
- O redirecionamento para onboarding passa a usar esse novo status, então quem já está ok não será mais tratado como pendente por erro antigo.

5. Deixar a UI consistente e menos confusa
- Home (`Index.tsx`): mostrar banner só quando `description_status = 'pending'`
- Admin (`Admin.tsx`): trocar para status diretos:
  - `Descrição OK`
  - `Pendente`
- O painel lateral do admin deve usar exatamente a mesma regra do grid principal.
- `Onboarding.tsx`: se existir um texto antigo salvo mas o status estiver pendente, mostrar uma mensagem amigável de revisão, sem chamar de “curta” por contagem de palavras.
- Remover o atalho duplicado de reset da `Index.tsx` e deixar a redefinição apenas na engrenagem/Config, liberada só para premium, como você pediu.

Arquivos impactados

- `src/hooks/useUserProfile.ts`
- `src/pages/Onboarding.tsx`
- `src/pages/Index.tsx`
- `src/pages/Admin.tsx`
- `src/components/Navigation.tsx`
- `supabase/migrations/...` para a nova coluna
- update de dados no banco para preencher o novo status

Resultado esperado

- Se você salvar a descrição novamente, ela não será mais trocada de volta pelo valor antigo.
- O banner some após a conclusão correta.
- Usuários com descrição já preenchida deixam de aparecer como pendentes.
- Usuários com `lifestyle` continuam pendentes até preencherem de verdade.
- A redefinição da matriz fica clara: só pela engrenagem e só para premium.
