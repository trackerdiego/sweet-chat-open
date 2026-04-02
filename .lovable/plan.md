

# Adicionar acesso ao painel admin na navegação

## Problema
A página `/admin` existe e funciona, mas não há nenhum botão ou link visível no app. O usuário admin precisa digitar a URL manualmente.

## Plano

### 1. Adicionar link condicional na Navigation
- Em `src/components/Navigation.tsx`, verificar se o usuário logado é o admin (`agentevendeagente@gmail.com`)
- Se sim, exibir um ícone/link para `/admin` na barra de navegação (ex: ícone de escudo ou engrenagem)
- Usuários normais não veem nada

### 2. Implementação
- Usar `supabase.auth.getUser()` ou o hook `useUserProfile` para obter o email do usuário atual
- Comparar com o email admin hardcoded
- Renderizar um `NavLink` adicional apontando para `/admin` apenas quando for admin

### Resultado
- O admin vê um ícone extra na navegação que leva ao painel
- Usuários comuns não são afetados

