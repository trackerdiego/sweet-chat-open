

# Corrigir Imagens Não Exibidas

## Problema
Os assets foram copiados mas os componentes não os importam. Comparando com o Aura OS:

- **Landing.tsx**: Falta `import logoHorizontal` e `import heroIllustration`. A nav usa texto "InfluLab" em vez da logo. O hero não mostra a ilustração.
- **Auth.tsx**: Falta `import logo` e `import authBg`. Não exibe logo nem background.

## Plano

### 1. Atualizar Landing.tsx
- Adicionar imports: `logoHorizontal` de `@/assets/influlab-logo-horizontal.png` e `heroIllustration` de `@/assets/hero-illustration.png`
- Na nav, trocar o `<span>InfluLab</span>` por `<img src={logoHorizontal} alt="InfluLab" className="h-9 w-auto" />`
- No hero, adicionar a coluna direita com `<img src={heroIllustration}>` (grid de 2 colunas como no Aura OS)
- Atualizar nav para fundo branco (`bg-white/95` com texto escuro) como no original

### 2. Atualizar Auth.tsx
- Adicionar imports: `logo` de `@/assets/influlab-logo.png` e `authBg` de `@/assets/auth-bg.png`
- Usar a logo e o background conforme o Aura OS

### 3. Verificar index.html
- Confirmar que o favicon aponta para `/favicon.png`

## Detalhes Técnicos
- Os arquivos de imagem já existem em `src/assets/` e `public/`
- As mudanças são apenas de import e uso no JSX
- O Landing.tsx será substituído pela versão completa do Aura OS para garantir paridade total

