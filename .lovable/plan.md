## Objetivo
Mostrar o vídeo Wistia `e9u6kg4om8` (vertical 9:16 — "como adicionar o app à tela inicial") em um **modal automático no primeiro login** do usuário, com opção de fechar e não exibir novamente.

## Estratégia

**Gatilho:** primeiro login após signup. Como o app já tem onboarding obrigatório, o melhor momento é **logo após o usuário concluir o onboarding e cair no `/` pela primeira vez** — ali ele acabou de virar usuário ativo e precisa instalar o PWA pra receber push/usar offline.

**Persistência:** flag em `localStorage` (`influlab.installVideoSeen=1`). Sem schema novo, sem backend, sem migration. Se o user trocar de device, vê de novo — aceitável (é tutorial de instalação, faz sentido por device).

**Não exibir quando:**
- Já está em PWA standalone (`display-mode: standalone` ou `navigator.standalone`) — já instalou.
- Está dentro de iframe / preview Lovable — evita poluir dev.
- Já marcou como visto.

## Arquivos

1. **`src/components/InstallVideoModal.tsx`** (novo)
   - Dialog do shadcn, fundo escuro, fecha em X ou "Já instalei / Ver depois".
   - Carrega o script `player.js` + `e9u6kg4om8.js` via `useEffect` (uma vez, com cleanup-safe — checa se já foi adicionado).
   - Renderiza `<wistia-player media-id="e9u6kg4om8" aspect="0.5625" />` num container 9:16 com `max-h-[80vh]` mobile-first.
   - Botão secundário "Não mostrar novamente" → grava localStorage e fecha.

2. **`src/pages/Index.tsx`** (edição mínima)
   - `useEffect` no mount: se `!localStorage['influlab.installVideoSeen']` && não-standalone && não-iframe && `profile.onboarding_completed` → abre modal após 800ms (deixa a página renderizar).
   - Reaproveita lógica existente de `useInAppBrowser` / detecção standalone que já temos em `useInstallPrompt`.

3. **`src/data/tutorials.ts`** (opcional, sem mudanças necessárias)
   - O vídeo `e9u6kg4om8` é específico de instalação, separado dos 5 tutoriais de funcionalidades — não entra nesse catálogo.

## Detalhes técnicos

- **Tipo do custom element:** declarar global em `src/vite-env.d.ts` pra TS não reclamar:
  ```ts
  declare namespace JSX {
    interface IntrinsicElements {
      'wistia-player': React.DetailedHTMLProps<any, any> & { 'media-id': string; aspect?: string };
    }
  }
  ```
- **Scripts Wistia:** injetar via `document.createElement('script')` com `data-wistia-loaded` flag pra não duplicar entre navegações SPA.
- **Acessibilidade:** `aria-label`, foco no botão fechar, ESC fecha.
- **Mobile:** vídeo 9:16, container `max-w-[360px]` centralizado, modal full-screen no mobile (<sm).

## Fora do escopo

- Re-exibir manualmente (poderíamos adicionar um link "Como instalar" em `/ajuda` depois, fácil).
- Tracking de visualizações (sem analytics novo).
- Forçar instalação — só ensina, user fecha quando quiser.

## Deploy

100% frontend → auto-deploy Vercel. Sem VPS, sem edge function, sem SQL.