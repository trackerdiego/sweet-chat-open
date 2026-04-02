

# Corrigir layout do Consultor IA e erro de conexao intermitente

## Problemas identificados

1. **Layout estoura a tela**: O `AiChat` usa `h-[calc(100vh-12rem)]` mas esta dentro do container da pagina Tools que tem `min-h-screen pb-24 px-4`. No mobile, o textarea expande ao digitar e empurra o botao de envio para fora da tela visivel.

2. **Erro de conexao na primeira mensagem**: O `streamChat` usa `getSession()` que pode retornar um token expirado. A segunda tentativa funciona porque o Supabase ja fez refresh automatico.

## Plano

### 1. Corrigir layout do AiChat (`src/components/AiChat.tsx`)
- Trocar o container principal para usar altura fixa relativa ao viewport com `overflow-hidden`
- Usar `flex flex-col` com o scroll area em `flex-1 min-h-0 overflow-y-auto`
- Fixar a area de input com `shrink-0` (ja existe) e garantir que nao cresca alem do limite
- Ajustar a altura do container para considerar a nav bottom (pb-24 = 6rem) e o header

### 2. Ajustar o container no Tools.tsx quando o chat esta ativo
- Quando `selectedTool.id === 'chat'`, trocar o container pai para nao usar `min-h-screen pb-24` e sim um layout flex que preenche a tela sem overflow
- Isso evita que o chat fique "solto" dentro de um container scrollavel

### 3. Corrigir erro de conexao intermitente (`src/components/AiChat.tsx`)
- Na funcao `streamChat`, trocar `getSession()` por `getUser()` ou forcar refresh do token antes de chamar a API
- Alternativa mais simples: usar `supabase.auth.getSession()` e, se falhar o fetch, fazer um retry automatico (1 tentativa)

## Detalhes tecnicos

**Layout fix**: O container do chat quando ativo no Tools precisa ser:
```
div className="flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100dvh-5rem)]"
```
Usando `100dvh` (dynamic viewport height) que respeita a barra do navegador mobile.

**Retry fix**: Envolver o `fetch` em um retry simples - se retornar erro de rede, tentar uma vez mais apos `getSession()` forcar refresh.

