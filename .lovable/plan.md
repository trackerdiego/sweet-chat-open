## Diagnóstico

Os logs do edge function confirmam `welcome email sent to mentecomp@gmail.com` e `...diegotelecom@hotmail.com` — o SMTP `acesso.host.servidorsaturno.com.br:465` aceitou as duas. Mas nenhuma chegou (nem no spam do Hotmail). Como o **recovery do GoTrue chega normalmente** usando o **mesmo servidor e mesma conta**, está descartado:

- DNS/SPF/DKIM/DMARC do `vyrallab.online` (funcionam pra recovery)
- Reputação do IP do servidor (funciona pra recovery)
- Credenciais SMTP (autenticou ok)

Sobrou um único suspeito: **a biblioteca `denomailer@1.6.0` está montando uma mensagem que o servidor `servidorsaturno` aceita no SMTP mas descarta internamente** (provavelmente porque falta `Message-ID`, `Date` em formato RFC, ou outro header crítico pro pipeline de DKIM/relay deles). O servidor não devolve bounce — só engole.

## Plano

### 1. Trocar `denomailer` por `nodemailer` no `send-welcome-email`

`nodemailer` é a lib mais madura do ecossistema (15+ anos), roda nativamente no Deno via `npm:nodemailer@6`, gera headers RFC-compliant completos (`Message-ID`, `Date`, `MIME-Version`, etc.) e tem suporte sólido tanto a porta 465 (SSL) quanto 587 (STARTTLS). Mesma lib que vou tornar padrão se outros senders aparecerem.

Estrutura da reescrita:

```ts
import nodemailer from "npm:nodemailer@6.9.16";

const transporter = nodemailer.createTransport({
  host: Deno.env.get("SMTP_HOST"),
  port: Number(Deno.env.get("SMTP_PORT") ?? 465),
  secure: Number(Deno.env.get("SMTP_PORT")) === 465, // true para 465, false para 587
  auth: {
    user: Deno.env.get("SMTP_USER"),
    pass: Deno.env.get("SMTP_PASS"),
  },
});

const info = await transporter.sendMail({
  from: `"${Deno.env.get("SMTP_FROM_NAME")}" <${Deno.env.get("SMTP_FROM")}>`,
  to: email,
  subject: "Bem-vindo ao Vyral Lab",
  html: htmlTemplate,
  // headers extras opcionais p/ rastreio
});

console.log("[welcome] messageId:", info.messageId, "response:", info.response);
```

### 2. Logar `messageId` e `response` do SMTP

Hoje o log só diz `welcome email sent`. Com nodemailer vou logar o `Message-ID` retornado e a resposta crua do servidor (`250 OK queued as ...`). Isso permite, na próxima falha:

- Pegar o `Message-ID` no log da Lovable
- Procurar esse ID no mailqueue do servidorsaturno (via cPanel/webmail)
- Confirmar se a mensagem realmente saiu ou ficou presa lá

### 3. Manter porta 465 (já validado funcionando)

Não mexer em `.env` nem no `docker-compose.yml`. O nodemailer fala 465 SSL nativamente, sem o bug de STARTTLS do denomailer.

### 4. Pacote de comando p/ VPS no final

Depois que eu editar o `index.ts`, te devolvo o bloco copia-e-cola padrão do projeto:

```bash
cd /root/app && git pull && ./scripts/deploy-selfhost.sh send-welcome-email
docker logs supabase-edge-functions --tail 20 2>&1 | grep -i welcome
```

### 5. Validação

Após o deploy, você testa de novo com `curl` pra `mentecomp@gmail.com` e `diegotelecom@hotmail.com` e me manda:
- Saída do `curl` (espera-se `{"ok":true}`)
- Os logs com o novo `messageId` e `response`
- Se chegou nas caixas

Se ainda não chegar com nodemailer + headers RFC-completos, o problema está **dentro do servidorsaturno** (filtro de saída, IP em blacklist própria, conta sem permissão de relay external) — aí o próximo passo é abrir ticket com eles enviando o `Message-ID` que logamos.

## Detalhes técnicos

- Arquivo alterado: `supabase/functions/send-welcome-email/index.ts`
- Sem mudanças em DB, secrets ou outras functions
- Sem mudanças em `docker-compose.yml` ou `.env`
- `denomailer` removido como dependência (era import direto, não precisa mexer em lockfile)
- O fix do `check-email-exists` (erro `Invalid schema: auth` que apareceu no log) **não está no escopo desta tarefa** — é outra função, não afeta envio. Posso tratar em sequência se quiser.
