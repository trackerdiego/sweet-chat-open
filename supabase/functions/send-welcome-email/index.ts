// Envia email de boas-vindas após o 1º pagamento confirmado.
// Usa o mesmo SMTP self-hosted (mail.vyrallab.online) que o GoTrue usa pros emails de auth.
// Idempotência: o caller (asaas-webhook) só invoca se subscription_state.welcome_email_sent_at IS NULL.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://app.vyrallab.online";

function buildHtml(displayName: string | null): string {
  const greet = displayName && displayName.trim().length > 0 ? displayName.split(" ")[0] : "creator";
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Bem-vindo(a) ao VyralLab</title>
</head>
<body style="margin:0;padding:0;background:#0F0A1F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a2e;">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">Salve este email: aqui mora seu link de acesso sempre que precisar.</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0F0A1F;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(139,92,246,0.25);">
      <tr><td style="background:linear-gradient(135deg,#8B5CF6 0%,#6D28D9 100%);padding:40px 32px;text-align:center;">
        <div style="font-size:13px;letter-spacing:3px;color:rgba(255,255,255,0.7);font-weight:600;">VYRALLAB</div>
        <h1 style="margin:12px 0 0;color:#ffffff;font-size:28px;line-height:1.2;font-weight:700;">Seu acesso está liberado 🚀</h1>
      </td></tr>
      <tr><td style="padding:36px 32px 8px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1a1a2e;">Olá, <strong>${greet}</strong>!</p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3a3a4e;">Seu pagamento foi confirmado e seu plano <strong>VyralLab</strong> está <strong>ativo agora mesmo</strong>. Bem-vindo(a) ao laboratório que vai transformar a sua estratégia de conteúdo.</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3a3a4e;">Para garantir que você nunca perca o acesso, <strong>salve este email</strong>. Sempre que precisar voltar pro app, o link está logo abaixo.</p>
      </td></tr>
      <tr><td align="center" style="padding:0 32px 32px;">
        <a href="${APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#8B5CF6 0%,#6D28D9 100%);color:#ffffff;text-decoration:none;padding:16px 36px;border-radius:12px;font-size:16px;font-weight:700;box-shadow:0 8px 24px rgba(139,92,246,0.4);">Acessar VyralLab agora</a>
        <p style="margin:14px 0 0;font-size:13px;color:#6b7280;">ou copie: <a href="${APP_URL}" style="color:#8B5CF6;text-decoration:none;">${APP_URL}</a></p>
      </td></tr>
      <tr><td style="padding:0 32px 32px;">
        <div style="background:#F5F3FF;border:1px solid #EDE9FE;border-radius:14px;padding:20px 22px;">
          <h2 style="margin:0 0 10px;font-size:15px;color:#6D28D9;font-weight:700;">📱 Tenha o VyralLab na palma da mão</h2>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#3a3a4e;">Instale como app no seu celular pra abrir com 1 toque, sem entrar no navegador:</p>
          <p style="margin:0 0 4px;font-size:13px;line-height:1.55;color:#3a3a4e;"><strong>iPhone:</strong> abra o link no Safari → botão Compartilhar → <em>Adicionar à Tela de Início</em>.</p>
          <p style="margin:0;font-size:13px;line-height:1.55;color:#3a3a4e;"><strong>Android:</strong> abra no Chrome → menu (⋮) → <em>Instalar app</em>.</p>
        </div>
      </td></tr>
      <tr><td style="padding:0 32px 36px;">
        <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#3a3a4e;">Qualquer dúvida, é só responder este email — a gente lê todas.</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#3a3a4e;">Bora viralizar 💜<br/><strong>Equipe VyralLab</strong></p>
      </td></tr>
      <tr><td style="background:#FAFAFA;padding:18px 32px;text-align:center;border-top:1px solid #F0F0F5;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">VyralLab • <a href="${APP_URL}" style="color:#9ca3af;text-decoration:none;">app.vyrallab.online</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildText(displayName: string | null): string {
  const greet = displayName && displayName.trim().length > 0 ? displayName.split(" ")[0] : "creator";
  return `Olá, ${greet}!

Seu pagamento foi confirmado e seu plano VyralLab está ATIVO agora mesmo.

Acesse: ${APP_URL}

Salve este email — assim você sempre tem o link de acesso à mão, mesmo que perca o atalho ou não instale o PWA.

Instale como app:
- iPhone (Safari): Compartilhar → Adicionar à Tela de Início
- Android (Chrome): Menu (⋮) → Instalar app

Qualquer dúvida, é só responder este email.

Bora viralizar,
Equipe VyralLab
${APP_URL}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, displayName } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const host = Deno.env.get("SMTP_HOST") ?? Deno.env.get("GOTRUE_SMTP_HOST");
    const port = Number(Deno.env.get("SMTP_PORT") ?? Deno.env.get("GOTRUE_SMTP_PORT") ?? "587");
    const username = Deno.env.get("SMTP_USER") ?? Deno.env.get("GOTRUE_SMTP_USER");
    const password = Deno.env.get("SMTP_PASS") ?? Deno.env.get("GOTRUE_SMTP_PASS");
    const fromAddr = Deno.env.get("SMTP_FROM") ?? Deno.env.get("GOTRUE_SMTP_ADMIN_EMAIL") ?? "no-reply@vyrallab.online";
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "VyralLab";

    if (!host || !username || !password) {
      console.error("SMTP creds missing", { hasHost: !!host, hasUser: !!username, hasPass: !!password });
      return new Response(JSON.stringify({ error: "smtp_not_configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: username, pass: password },
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: email,
      subject: "Bem-vindo(a) ao VyralLab — seu acesso está liberado 🚀",
      text: buildText(displayName ?? null),
      html: buildHtml(displayName ?? null),
    });

    console.log("[welcome] sent to", email, "messageId:", info.messageId, "response:", info.response, "accepted:", info.accepted, "rejected:", info.rejected);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-welcome-email error:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
