

# Melhorar instruções de instalação do PWA para usuários leigos

## Problema

Os banners atuais (InstallBanner e InAppBrowserBanner) são finas barras no topo com texto pequeno. Usuários leigos não entendem o que precisam fazer, especialmente no iOS onde o processo exige múltiplos passos manuais (compartilhar → adicionar à tela).

## Solução

Transformar as instruções em um **modal/dialog visual com passo-a-passo ilustrado**, em vez de um banner fino ou um toast rápido.

### 1. Novo componente `InstallInstructionsModal.tsx`

Um Dialog/Drawer que abre quando o usuário toca "Como instalar" no InstallBanner (iOS) ou quando está no navegador in-app. Contém:

- **Título grande**: "Instale o InfluLab no seu celular"
- **Passo-a-passo numerado com ícones grandes**:
  - **iOS (Safari)**: 
    1. Toque no ícone de compartilhar (ícone Share grande e colorido) na barra inferior do Safari
    2. Role para baixo e toque em "Adicionar à Tela de Início"
    3. Toque em "Adicionar" no canto superior direito
  - **iOS (navegador in-app)**:
    1. Toque em "Copiar link" (botão grande)
    2. Abra o Safari
    3. Cole o link na barra de endereço
    4. Siga os passos de instalação acima
  - **Android**: Botão grande "Instalar agora" que dispara o prompt nativo
- Cada passo com **ícone grande**, **texto claro em linguagem simples**, e **destaque visual** (numbered circles)
- Botão de fechar discreto

### 2. Alterar `InstallBanner.tsx`

- No iOS, em vez de mostrar um toast com texto, abrir o `InstallInstructionsModal`
- Aumentar levemente o banner: texto um pouco maior, botão mais chamativo
- Texto do botão: "Ver como instalar" (mais claro que "Como fazer")

### 3. Alterar `InAppBrowserBanner.tsx`

- No iOS, ao tocar "Copiar link", além de copiar, abrir o modal com instruções visuais do que fazer depois (abrir Safari, colar, etc.)
- Tornar o banner mais visualmente impactante: fundo mais contrastante, texto maior

### Arquivos impactados
- **Novo** `src/components/InstallInstructionsModal.tsx` — modal com passo-a-passo visual
- **Editar** `src/components/InstallBanner.tsx` — abrir modal no iOS em vez de toast
- **Editar** `src/components/InAppBrowserBanner.tsx` — abrir modal após copiar link no iOS

