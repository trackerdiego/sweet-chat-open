

# Plano: regenerar 5 templates HTML com a URL real da logo

## URL da logo confirmada

```
https://api.influlab.pro/storage/v1/object/public/emails/imagens/ChatGPT%20Image%2020%20de%20mar.%20de%202026,%2012_05_13%20(1).png
```

Já está URL-encoded (espaços como `%20`, vírgula preservada) — pronta pra uso direto no `<img src="...">`.

## O que vou fazer

1. **Regenerar `recovery.html`** do zero (o anterior estava corrompido / não abria no preview)
2. **Substituir `{{LOGO_URL}}`** pela URL real nos 5 templates:
   - `recovery.html`
   - `confirmation.html`
   - `magic-link.html`
   - `invite.html`
   - `email-change.html`
3. **QA visual**: renderizar cada HTML em PNG via headless Chromium e inspecionar — confirmar que a logo carrega da URL pública, botão CTA aparece roxo, layout está íntegro nos 5
4. **Empacotar** em `/mnt/documents/influlab-email-templates-v2.zip`

## Estrutura visual mantida

Mesma da v1 (já aprovada):
- Container 600px centralizado, fundo `#ffffff`
- Logo no topo, `max-width: 180px`, centralizada — agora carregando da URL real
- Faixa de acento gradiente roxo→violeta (`hsl(258 60% 55%)` → `hsl(280 70% 60%)`)
- Título `hsl(260, 20%, 15%)`, corpo `hsl(260, 10%, 45%)`
- Botão CTA roxo sólido, `border-radius: 12px`, padding 14px 28px
- Footer com link pro app + email do destinatário
- Inline styles + layout em `<table>` (compat Outlook/Gmail/iOS Mail)

## Placeholders GoTrue mantidos

```
{{ .ConfirmationURL }}  → href do botão CTA
{{ .Email }}            → email do destinatário (footer)
{{ .NewEmail }}         → email novo (só email-change.html)
{{ .SiteURL }}          → link do app no footer
```

## Saída

Único artefato: `influlab-email-templates-v2.zip` contendo os 5 HTMLs prontos pra subir no bucket `emails` do seu Supabase self-hosted e apontar no GoTrue.

## Próximos passos pós-entrega (instruções que vou repetir na resposta)

1. Subir os 5 HTMLs no bucket público (ex: `emails/templates/`)
2. Pegar a URL pública de cada template
3. Editar `~/supabase/docker/.env`:
   ```
   GOTRUE_MAILER_TEMPLATES_RECOVERY=https://api.influlab.pro/storage/v1/object/public/emails/templates/recovery.html
   GOTRUE_MAILER_SUBJECTS_RECOVERY="Redefinir sua senha"
   # (repetir pros outros 4)
   ```
4. `docker compose up -d --force-recreate auth`

## O que NÃO faço

- Não embuto base64 (Gmail/Outlook bloqueiam)
- Não toco no app, edge functions, ou auth-email-hook
- Não chamo `email_domain--*` tools (irrelevantes pro fluxo self-hosted GoTrue puro)

