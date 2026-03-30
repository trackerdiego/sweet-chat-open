

# Corrigir Responsividade Mobile

## Problemas

1. **Scroll horizontal indesejado** — o app inteiro se move lateralmente ao arrastar no mobile, indicando que algum elemento extravasa a largura da viewport
2. **Nav bar extravasando no iPhone** — a barra fixa do topo (com "Entrar" e "Começar gratis") nao respeita o safe-area dos iPhones modernos (notch/Dynamic Island)

## Causa Raiz

- O `<div>` raiz da Landing tem `overflow-x-hidden` mas o `<html>` e `<body>` nao tem, entao o scroll lateral ainda e possivel no nivel do documento
- Elementos com gradientes absolutos (ex: `w-[60%]`, `w-96`) podem ultrapassar a viewport
- A nav fixa nao usa `safe-area-inset` para padding superior no iPhone

## Plano

### 1. Travar scroll horizontal no CSS global

**Arquivo:** `src/index.css`

Adicionar no `@layer base`:
```css
html, body {
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
```

### 2. Aplicar safe-area na nav da Landing

**Arquivo:** `src/pages/Landing.tsx`

- Na `<nav>` fixa (linha 172): adicionar `pt-[env(safe-area-inset-top)]` para que o conteudo nao fique embaixo do notch/Dynamic Island
- Garantir que o padding da nav respeite as bordas laterais com `px-[max(1rem,env(safe-area-inset-left))]`

### 3. Aplicar safe-area na Navigation do app logado

**Arquivo:** `src/components/Navigation.tsx`

- A bottom nav ja usa `pb-[env(safe-area-inset-bottom)]` — OK
- Na versao desktop (top), adicionar `pt-[env(safe-area-inset-top)]` para consistencia

### 4. Conter elementos absolutos que extravasam

**Arquivo:** `src/pages/Landing.tsx`

- No hero, as divs de gradiente absoluto (linhas 200-205) ja estao dentro de um container com `overflow-hidden` — verificar que o wrapper pai tambem contenha com `overflow-hidden`
- Na secao Final CTA (linha 526), o `overflow-hidden` ja esta presente — OK

### Arquivos alterados

1. `src/index.css` — overflow-x hidden global
2. `src/pages/Landing.tsx` — safe-area na nav + conter gradientes
3. `src/components/Navigation.tsx` — safe-area top (se necessario)

