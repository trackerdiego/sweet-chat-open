## Problema
Ao compartilhar o app (WhatsApp/redes), a thumbnail mostra o logo antigo do InfluLab. O arquivo `public/og-image.png` precisa ser substituído pelo novo logo VyralLab.

## Plano

1. **Gerar novo `og-image.png`** (1200x630, formato OG padrão) a partir do logo VyralLab enviado:
   - Logo centralizado sobre fundo escuro (combinando com a paleta roxo/violeta do app)
   - Tagline curta opcional ("Laboratório de conteúdo viral com IA")

2. **Atualizar tags meta no `index.html`** para forçar refresh de cache dos crawlers:
   - Adicionar querystring de versão: `/og-image.png?v=2` em `og:image` e `twitter:image`
   - Garantir `og:image:width=1200` e `og:image:height=630`

3. **Verificar favicon e apple-touch-icon** — se também estiverem com logo antigo, regenerar:
   - `public/favicon.png`
   - `public/apple-touch-icon.png` (180x180)
   - `public/icons/icon-192.png` e `icon-512.png` (PWA)

## Pergunta antes de executar
- Atualizo **só o og-image** (compartilhamento) ou **também o favicon + ícones PWA** (que aparecem na aba do browser e na home screen)?

## Observações
- Crawlers (WhatsApp, Facebook, LinkedIn) cacheiam thumbnails agressivamente. Mesmo após o deploy, o link compartilhado anteriormente continuará mostrando a versão antiga até o cache expirar. Para forçar refresh: usar o [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) colando a URL e clicando "Scrape Again".
- Frontend hospedado na Vercel → deploy automático no push do `main`. Nenhuma ação na VPS necessária.
