

# Remover botão "Baixar App" da Landing Page

## Contexto
O botão "Baixar App" na hero section da landing tem dois problemas:
1. **Bug visual**: O variant `outline` renderiza com fundo branco no contexto escuro, tornando o texto ilegível (só aparece no hover)
2. **UX inadequado**: Oferecer instalação PWA antes do cadastro não faz sentido -- o usuário ainda não conhece o produto

O componente `InstallBanner.tsx` já existe e aparece dentro do app após login, que é o local apropriado para essa ação.

## Plano

### Arquivo: `src/pages/Landing.tsx`

1. **Remover o bloco do botão "Baixar App"** (linhas 258-267) -- o `{canInstall && (...)}` inteiro
2. **Remover imports não utilizados** após a remoção:
   - `useInstallPrompt` (linha 33)
   - `toast` de sonner (linha 34) -- verificar se é usado em outro lugar do arquivo
   - A desestruturação `canInstall, isIOS, hasNativePrompt, promptInstall` (linha 170)
   - A função `handleDownload` (linhas 172-179)

Nenhum outro arquivo é afetado.

