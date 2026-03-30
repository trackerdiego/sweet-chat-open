

# Melhorar UX de Notificacoes em Ambiente de Preview

## Situacao

O codigo de push e identico ao projeto Aura OS. A falha ocorre apenas no preview/iframe do Lovable, onde o browser bloqueia `pushManager.subscribe()`. Na URL publicada funciona normalmente.

## Plano

### 1. Adicionar guard no registro do SW

**Arquivo:** `src/main.tsx`

Antes de registrar o service worker, verificar se esta em iframe ou dominio de preview. Se sim, pular o registro e desregistrar SWs existentes:

```typescript
const isInIframe = window.self !== window.top;
const isPreview = window.location.hostname.includes('id-preview--');

if (!isInIframe && !isPreview) {
  navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
} else {
  navigator.serviceWorker?.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}
```

### 2. Mensagem contextual no erro

**Arquivo:** `src/components/Navigation.tsx`

Quando `subscribe()` retorna false e o app esta em iframe/preview, mostrar toast explicativo: "Notificacoes push funcionam apenas na versao publicada ou no app instalado" em vez do generico "nao foi possivel ativar".

### Arquivos alterados

1. `src/main.tsx` — guard de preview/iframe
2. `src/components/Navigation.tsx` — toast contextual

