## Objetivo
Trocar o ícone do PWA pela nova arte (cérebro/laboratório neon) e corrigir o bug do iPhone 15/16 mostrando ícone vazio no home screen.

## Causa do ícone faltando no iPhone 15/16
- iOS 15+ exige um `apple-touch-icon` **180×180 PNG sem transparência**.
- O `index.html` atual aponta para `/icons/icon-192.png`, que está declarado no manifest como `purpose: "any maskable"`. O iOS não entende "maskable" e em alguns casos descarta o ícone.
- Solução: arquivo dedicado `/apple-touch-icon.png` (180×180, fundo sólido) + separar `any` e `maskable` no manifest.

## Mudanças

### 1. Novos arquivos de ícone (já gerados em `public/`)
- `public/icons/icon-192.png` → 192×192, novo design, fundo branco
- `public/icons/icon-512.png` → 512×512, novo design, fundo branco
- `public/apple-touch-icon.png` → 180×180 dedicado iOS, fundo branco sólido
- `public/favicon.png` → 64×64 atualizado

### 2. `public/manifest.json`
Separar declarações `any` e `maskable` (em vez de combinar). Ambas apontam para os mesmos PNGs por enquanto.

### 3. `index.html` (linha 7)
Adicionar link explícito 180×180 + manter 192 como fallback:
```html
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
```

### 4. `public/sw-push.js` (linha 2)
Bump `CACHE_NAME` de `vyrallab-v3` → `vyrallab-v4` para forçar devices a baixar os ícones novos no próximo carregamento.

## Limitação do iOS (aviso pro user)
Apps PWA **já instalados** no iPhone cacheiam ícones na hora da instalação — quem já adicionou à home screen vai precisar **remover e reinstalar** o ícone pra ver a nova arte. Para novos installs, aparece direto.

## Depois do merge — deploy
Frontend Vercel pega o push do GitHub automaticamente. Nada de Docker pra rodar.
