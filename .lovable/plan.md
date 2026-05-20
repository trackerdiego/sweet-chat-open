# Limpeza total: InfluLab → Vyral Lab nos emails

O `.env` que você colou mostra que ainda tem resquícios do InfluLab em dois lugares:

1. **Subjects (assuntos)** — todos dizem "InfluLab" / "InfluLab AI"
2. **Templates HTML no Storage** (bucket `emails/emails/`) — são os antigos do InfluLab

O `SMTP_SENDER_NAME` já está como "Vyral Lab AI" ✅ (se quiser só "Vyral Lab" sem o "AI", a gente ajusta).

---

## Parte 1 — Atualizar subjects no `.env`

Trocar no `~/supabase/docker/.env`:

```
MAILER_SUBJECTS_INVITE="Você foi convidado para a Vyral Lab"
MAILER_SUBJECTS_CONFIRMATION="Confirme seu e-mail - Vyral Lab"
MAILER_SUBJECTS_RECOVERY="Recuperação de senha - Vyral Lab"
MAILER_SUBJECTS_MAGIC_LINK="Seu link de acesso - Vyral Lab"
MAILER_SUBJECTS_EMAIL_CHANGE="Confirme a alteração do seu e-mail - Vyral Lab"
```

E, se você confirmar, também:
```
SMTP_SENDER_NAME=Vyral Lab
```
(remover o "AI" — me diga se prefere manter "Vyral Lab AI")

Depois: `cd ~/supabase/docker && docker compose up -d --force-recreate auth`

---

## Parte 2 — Criar os 5 templates HTML novos (Vyral Lab)

Vou gerar 5 arquivos standalone, todos com a mesma identidade visual (fundo branco, card glassmorphism sutil, headline serifada, CTA roxo `#7c3aed`, footer minimalista) que já usamos no `recovery.html`:

| Arquivo | Variável GoTrue | Conteúdo |
|---|---|---|
| `confirmation.html` | `{{ .ConfirmationURL }}` | Confirmar e-mail no cadastro |
| `recovery.html` | `{{ .ConfirmationURL }}` | Redefinir senha (já entregue antes — vou re-entregar atualizado) |
| `invite.html` | `{{ .ConfirmationURL }}` | Convite para a plataforma |
| `magic_link.html` | `{{ .ConfirmationURL }}` | Login sem senha |
| `email_change.html` | `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}` | Confirmar troca de e-mail |

Vou entregar os 5 arquivos em `/mnt/documents/` para você **substituir manualmente** no Studio self-hosted:

Storage → bucket `emails` → pasta `emails/` → upload por cima (substituir os 5 antigos com o MESMO nome).

Depois do upload **não precisa reiniciar o GoTrue** — ele lê o template a cada envio (cache curto).

---

## Parte 3 — Validação

Depois de aplicar:

1. **Recuperação de senha** (já testado, vai chegar com template novo)
2. **Cadastro novo** → como `ENABLE_EMAIL_AUTOCONFIRM=true`, o `confirmation.html` só dispara se você desligar o autoconfirm. Quer testar? Posso te dar o comando, mas é opcional.
3. **Magic link / invite / email change** → testar pela tela de admin quando precisar.

---

## Detalhes técnicos

- Templates ficam no bucket público `emails`, path `emails/<nome>.html` — URL pública é a mesma que você já tem no `.env`, então **não precisa mexer nas variáveis `MAILER_TEMPLATES_*`**, só sobrescrever os arquivos.
- GoTrue baixa o template via HTTP a cada envio (com cache curto). Após substituir os arquivos no Storage, o próximo email já sai com o novo HTML.
- Todos usam Georgia (serif) no heading e system-ui no corpo — sem fontes externas (evita bloqueio em clients de email).
- Botão CTA: `#7c3aed` (purple-600), fallback link em texto, aviso de segurança e footer Vyral Lab.

---

## O que falta você me confirmar antes de eu gerar os arquivos

1. **Sender name final**: `Vyral Lab` ou manter `Vyral Lab AI`?
2. **Subjects** do bloco acima estão OK ou quer ajustar algum?
3. Posso gerar os 5 HTMLs de uma vez?