# Guardar na memória — 2 projetos pendentes (não executar agora)

Estou em plan mode e o sistema bloqueia escrita até em `mem://`. Aprovando este plano, salvo as duas memórias e paro — **nada de código é mexido**.

## Memória 1 — Push notifications ainda chegam como "Influ Lab"

**Diagnóstico já feito:** o código está 100% migrado para "Vyral Lab". Procurei no projeto inteiro: manifest, `sw-push.js`, payloads em `scheduled-push` e `notify-pix-due-soon` — tudo "Vyral Lab". O nome antigo aparece por **cache no dispositivo do usuário**, não por bug.

Causas reais:
- `CACHE_NAME = 'influlab-v1'` em `public/sw-push.js` — service worker antigo permanece registrado porque o nome do cache não mudou.
- PWA instalado guarda o `manifest.json` no OS. Android/iOS usam o app name cacheado como fallback ao renderizar notificações.
- Constantes residuais "InfluLab" ainda existem em backend não-push (`auth-email-hook` SITE_NAME, `create-asaas-subscription` description, `hype-sources` UA) — não afetam push, mas valem revisar no mesmo passe.

**Plano quando o user mandar executar:**
1. Bump `CACHE_NAME` → `vyrallab-v2` em `public/sw-push.js`.
2. Adicionar `tag: 'vyrallab-push'` e garantir `title` sempre presente no `showNotification`.
3. Avisar que **usuários com PWA já instalado precisam reinstalar** (limitação do OS, não dá pra contornar via código).
4. Opcional: limpar constantes residuais "InfluLab" em auth-email-hook, create-asaas-subscription, hype-sources.

## Memória 2 — Mosaico de 4 thumbs TikTok no painel

**Contexto:** Reddit API negou, YouTube entrega pouco signal de meme. Substituir o `HypeOfTheDay` por mosaico 2x2 de thumbs reais de TikTok trending BR.

**Stack decidida:** Apify `clockworks/tiktok-scraper`. Retorna `thumbnailUrl`, `videoUrl` (MP4), `playCount`, `author`, `musicName`, `hashtags`. Custo ~US$0,30/1000 itens, <US$10/mês.

**UX decidida:**
- Card 9:16 com thumb estático + stats; tap abre modal com `<video autoplay muted loop playsinline poster={thumbnailUrl}>` + gancho/formato/ângulo gerados pelo Gemini sobre o vídeo real.
- Lazy load do MP4 via IntersectionObserver.
- 1x/dia (cron 6h BRT), pool compartilhado entre usuários, custo mínimo.
- Sem Instagram (actor caro/instável).

**Pendente do user antes de implementar:** confirmar fonte, confirmar comportamento (estático+tap vs autoplay), confirmar frequência, e gerar `APIFY_TOKEN` pra adicionar como secret.

**Escopo técnico esperado quando rodar:**
- Tabela `daily_viral_videos` (date, rank, thumbnail_url, video_url, play_count, author, music_name, hashtags, source) — SQL manual no Studio self-hosted.
- Edge function `fetch-viral-videos` (cron diário, chama Apify Actor API).
- Refatorar `src/components/HypeOfTheDay.tsx` → mosaico 2x2.
- Modal com player + análise Gemini personalizada por nicho, seguindo padrão `mem://features/ai-jobs-pattern`.

---

## O que acontece ao aprovar este plano

Saio do plan mode, escrevo o arquivo `mem://features/pending-push-rebrand-and-tiktok-thumbs` com o conteúdo acima, atualizo o `mem://index.md` adicionando a referência, e paro. Zero alteração em código de aplicação.
