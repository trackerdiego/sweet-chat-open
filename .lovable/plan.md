
## Diagnóstico: é código, não é o aparelho dela

Investiguei `src/pages/Tools.tsx` e `src/App.tsx` e achei **3 causas** que explicam tela branca em Android — nenhuma é limitação do aparelho, todas são coisas que a gente pode consertar:

### Causa 1 — Zero ErrorBoundary no app inteiro
```
rg "ErrorBoundary|componentDidCatch|getDerivedStateFromError" src → 0 matches
```
Quando qualquer componente joga erro em runtime (fetch falha, JSON malformado, `undefined.length`), **o React desmonta a árvore inteira e sobra `<div id="root"></div>` vazio = tela branca**. Não tem fallback nenhum. Isso é o principal motivo de "tela branca" em qualquer app React.

### Causa 2 — `@ffmpeg/ffmpeg` importado no top-level da rota Tools
```ts
import { FFmpeg } from '@ffmpeg/ffmpeg';  // linha 14
import { fetchFile } from '@ffmpeg/util'; // linha 15
```
Só de abrir `/ferramentas` o bundle carrega ffmpeg-wasm (~30 MB de WASM + JS). Em Android intermediário/antigo (WebView com pouca RAM, Chrome mobile em aparelho com <3GB), isso pode:
- Estourar memória → aba morre → tela branca.
- Falhar ao baixar o WASM da unpkg (rede lenta / CORS) → throw não tratado → tela branca (por causa da Causa 1).
- Rodar em contexto sem `SharedArrayBuffer` / cross-origin-isolation → `ffmpeg.load()` joga exceção → tela branca.

Além disso, `getFFmpeg()` é chamado **só quando o user envia vídeo**, mas o **módulo em si** já foi importado no topo → o parse+eval do bundle acontece na abertura da página.

### Causa 3 — `runAiJob` faz polling infinito sem timeout de rede
Se a rede da usuária cair no meio do polling do job, o `fetch` fica pendente até estourar 5min. Enquanto isso ela clica em outra coisa → estado inconsistente → alguns componentes recebem `undefined` e rebentam.

## Plano de correção (3 arquivos, escopo pequeno)

### 1. Criar `src/components/ErrorBoundary.tsx`
Classe React clássica com `componentDidCatch` + fallback UI amigável ("Algo deu errado. Toque para recarregar."). Loga o erro no console e no `window.__lovable_last_error` pra debug futuro.

### 2. Envolver o app em `src/App.tsx`
Envolver o `<Routes>` inteiro em `<ErrorBoundary>`. E envolver **especificamente** cada rota pesada (Tools, Script, Matrix, Tasks) em um `<ErrorBoundary>` local com fallback específico, pra que um erro em Tools não derrube Painel/Config.

### 3. Lazy-load do ffmpeg em `src/pages/Tools.tsx`
Trocar o import top-level:
```ts
// ANTES
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// DEPOIS — só carrega quando o user realmente clica em enviar vídeo
const getFFmpeg = async () => {
  const [{ FFmpeg }, { fetchFile }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ]);
  // ...
};
```
Ganho: abertura da rota `/ferramentas` fica leve, sem carregar 30MB de WASM. Usuária que nunca enviou vídeo nunca paga esse custo.

Também vou adicionar **try/catch com fallback amigável** dentro de `handleFileUpload`: se o ffmpeg falhar (Android sem suporte), mostra toast `"Seu navegador não suporta processamento de vídeo. Envie um arquivo de áudio (.mp3) diretamente."` em vez de tela branca.

### 4. Timeout no `runAiJob`
Adicionar `AbortController` no `fetch` do polling com timeout de 15s por request. Se estourar, marca o job como erro em vez de deixar promise pendurada.

## Sobre "é o aparelho dela?"

**Não, é o app.** A causa raiz é a Causa 1 (falta ErrorBoundary): mesmo num iPhone 15, se acontece um erro qualquer numa ferramenta, a tela fica branca do mesmo jeito. O Android da usuária provavelmente só *dispara* o erro mais fácil (ffmpeg estourando memória) — mas o problema visível ("tela branca") é do nosso código não capturar o erro.

Depois desse fix:
- Erro de qualquer ferramenta → mostra card "Algo deu errado, toca pra tentar de novo" em vez de tela branca.
- Rota Tools abre 30MB mais leve.
- Envio de vídeo tem fallback claro se aparelho não suportar.

## Escopo

- Toca em: `src/components/ErrorBoundary.tsx` (novo), `src/App.tsx`, `src/pages/Tools.tsx`.
- Não mexe em backend, edge functions, RLS, cron.
- Não mexe em nenhuma outra tela.

## Validação
Depois de aplicar, testo via Playwright:
1. Simular throw dentro de `<Tools>` → confirmar que aparece o fallback ErrorBoundary e não tela branca.
2. Confirmar que a rota `/ferramentas` não importa `@ffmpeg` até o clique de upload (checo o network waterfall).
