

# Adicionar visualizacao completa de usuarios no painel admin

## Problema
Atualmente a tabela de usuarios no admin mostra apenas dados basicos (nome, email, nicho, plano, contadores). Nao ha como clicar em um usuario para ver todos os detalhes dele.

## Plano

### 1. Expandir a edge function `admin-dashboard` para retornar mais dados
- Incluir `onboarding_completed`, `content_style`, `audience_size`, `secondary_niches` e `created_at` dos profiles
- Incluir dados do `audience_profiles` (descricao do publico, avatar gerado)
- Incluir dados do `user_strategies` (se tem matriz gerada)
- Incluir `created_at` do auth user (data de cadastro)

### 2. Adicionar modal/drawer de detalhes do usuario no Admin.tsx
- Ao clicar em uma linha da tabela, abrir um Sheet (drawer lateral) com todas as informacoes do usuario:
  - Dados do perfil: nome, email, nicho, nichos secundarios, estilo de conteudo, tamanho da audiencia
  - Status: onboarding completo ou nao, data de cadastro
  - Uso: scripts, tools, chat, transcricoes com datas
  - Plano: free/premium
  - Se tem estudo de publico gerado (audience_profile)
  - Se tem matriz de estrategias gerada
- Cursor pointer nas linhas da tabela para indicar que sao clicaveis

### 3. Adicionar coluna "Onboarding" na tabela principal
- Badge verde "Completo" ou amarelo "Pendente" para identificar rapidamente quem completou

### Arquivos alterados
- `supabase/functions/admin-dashboard/index.ts` - retornar dados extras
- `src/pages/Admin.tsx` - drawer de detalhes + coluna onboarding

