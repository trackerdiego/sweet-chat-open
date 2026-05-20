## Parte 1 — Validar email antes de chamar `resetPasswordForEmail`

**Arquivo:** `src/pages/Auth.tsx` (função `handleForgotPassword`, linhas 46-62)

**Estratégia de validação:** chamar `supabase.auth.signInWithPassword({ email, password: '__probe_invalid_'+crypto.randomUUID() })` e ler o `error.message`:

- `"Invalid login credentials"` → email **existe** (senha errada). Prosseguir com `resetPasswordForEmail` e mostrar:
  > "Email de recuperação enviado! Verifique sua caixa de entrada (e o spam)."
- Mensagem contendo `"not found"` / `"user"` / qualquer outra → email **não cadastrado**. Mostrar:
  > "Não encontramos uma conta com este email. Verifique se digitou corretamente ou crie uma nova conta."
  
  Também oferecer botão "Criar conta" que troca pra tela de signup pré-preenchida com o email.

**Trade-off assumido (já confirmado):** essa abordagem permite enumeração de usuários — atacantes podem descobrir quais emails têm conta. Aceito em troca de UX mais clara.

**Rate-limit safety:** o GoTrue rate-limita o `signInWithPassword`. Se vier `"rate limit"`, fazer fallback pro comportamento atual (sempre mostrar "email enviado se existir") pra não travar o fluxo.

---

## Parte 2 — Novo template HTML `recovery.html` (Vyral Lab)

Gerar arquivo novo `recovery.html` com:

**Branding atualizado:**
- Header com gradiente roxo/violeta (paleta do app: `#7c3aed` → `#a855f7`)
- Logo: `https://api.influlab.pro/storage/v1/object/public/emails/Novo%20Projeto%20(75).png` (URL fornecida)
- Tamanho controlado (`max-width: 120px`, `height: auto`) e `alt="Vyral Lab"`
- Nome da marca: **"Vyral Lab"** em todos os lugares (substitui "InfluLab")
- Footer com `© 2026 Vyral Lab` + `app.vyrallab.online`

**Conteúdo (PT-BR, tom amigável):**
- H1: "Redefinir sua senha"
- Parágrafo: "Recebemos uma solicitação para redefinir a senha da sua conta **Vyral Lab**. Clique no botão abaixo para criar uma nova senha."
- Box de atenção: "⏰ Este link expira em **1 hora** por motivos de segurança."
- CTA: botão roxo "Redefinir minha senha" → `{{ .ConfirmationURL }}`
- Fallback: "Ou copie e cole este link no seu navegador:" + `{{ .ConfirmationURL }}` (quebra de linha com `word-break: break-all`)
- Aviso final: "Se você não solicitou essa redefinição, ignore este email. Sua senha continua segura."
- Preheader (texto invisível pra preview do inbox): "Redefina sua senha com segurança no Vyral Lab."

**Compatibilidade email:**
- HTML em tabelas (não usa flex/grid moderno)
- CSS inline em todos elementos críticos
- Sem JS, sem `<style>` externo
- `<meta name="viewport">` pra mobile

**Variáveis GoTrue mantidas:** `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .SiteURL }}`.

O arquivo será gravado em `/mnt/documents/recovery.html` pra você baixar e fazer upload no Studio self-hosted (bucket `emails/emails/recovery.html`, substituindo o atual). Não mexo no GoTrue nem no docker-compose — `MAILER_TEMPLATES_RECOVERY` já aponta pra esse caminho.

---

## Bloco de deploy (final)

Vou entregar:
1. Edit no `src/pages/Auth.tsx` → commit/push do Vercel pega automático.
2. Arquivo `recovery.html` no `/mnt/documents/` + instruções de **2 cliques no Studio**: abrir bucket `emails` → pasta `emails/` → upload (substituir) → testar pedindo recovery de novo.

Sem mexer em `~/supabase/docker/.env`, sem `docker compose restart`, sem migration.

---

## Fora do escopo

- Outros 4 templates (confirmation, magic_link, email_change, invite) ficam pra depois — você pode pedir num próximo turno e eu replico o mesmo branding.
- Mudar o "From name" no GoTrue (hoje vem como "InfluLab AI") — isso é env `GOTRUE_SMTP_SENDER_NAME` no `.env` do self-hosted, posso instruir se quiser.
