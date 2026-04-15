

# Corrigir tela de carregamento infinito

## Problema raiz

A função `fetchProfile` no `useUserProfile.ts` não tem `try/catch`. Se qualquer chamada ao Supabase falhar (rede instável, timeout, servidor lento), a função lança exceção e `setLoading(false)` nunca executa. O app fica preso em "Carregando..." eternamente.

## Solução

### 1. Adicionar try/catch com finally em `fetchProfile`

Envolver toda a lógica de `fetchProfile` em try/catch/finally para garantir que `setLoading(false)` sempre execute, mesmo com falhas de rede.

Se houver erro, exibir um toast com opção de tentar novamente.

### 2. Adicionar timeout de segurança

Incluir um timeout de 10 segundos no carregamento inicial. Se `loading` ainda estiver `true` após esse tempo, forçar `setLoading(false)` e mostrar a tela de login (fail-safe).

### 3. Proteger o preview do Lovable contra gerar token de sessão

No `fetchProfile`, verificar se o app está rodando dentro de um iframe ou em domínio de preview do Lovable. Se sim, pular a gravação do `active_session_token` no banco para evitar que o preview deslogue dispositivos reais.

### Arquivos impactados
- **Editar** `src/hooks/useUserProfile.ts` — try/catch/finally + timeout de segurança + skip token em preview

