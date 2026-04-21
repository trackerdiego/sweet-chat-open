

# Plano: diagnosticar por que a logo não carrega no email

## Confirmações do usuário

- A URL `https://api.influlab.pro/storage/v1/object/public/emails/imagens/ChatGPT%20Image%2020%20de%20mar.%20de%202026,%2012_05_13%20(1).png` **abre direto no navegador** ✅
- O bucket `emails` está marcado como **público** ✅

Se ambos são "sim", o HTML está correto e a logo deveria aparecer. Vou investigar por que não aparece.

## Hipóteses prováveis

1. **Você está abrindo o `.html` direto do disco** (file://) → muitos navegadores bloqueiam imagens externas em arquivos locais por CORS/mixed-context. **Isso NÃO afeta o email real** — quando o GoTrue enviar, o cliente de email (Gmail, Outlook) carrega normalmente.

2. **Caractere especial na URL** (vírgula `,` e parênteses `(1)`) — alguns parsers HTML/email tratam esses caracteres como delimitadores. Mesmo URL-encoded, é frágil. Renomear o arquivo no bucket pra algo limpo (`influlab-logo.png`) elimina o risco.

3. **Cache do preview do Lovable** servindo a versão antiga do HTML.

## O que vou fazer

1. **Abrir e inspecionar** os 5 HTMLs do `email-templates-v2` pra confirmar que a tag `<img src="...">` está correta e a URL real (não `{{LOGO_URL}}`) está lá
2. **Testar a URL da logo via curl** pra confirmar:
   - Status 200
   - `Content-Type: image/png`
   - Sem redirect estranho
   - Headers CORS permissivos
3. **Renderizar 1 template num PNG via headless Chromium** com network ativado, e checar:
   - Se a imagem carrega no contexto HTTP real
   - Se há erro de console (CORS, 404, mixed content)
4. **Diagnóstico final**: te dizer se o problema é só preview local (email real funciona) ou se precisa renomear a imagem no bucket

## Recomendação preventiva

Independente do diagnóstico, sugiro **renomear a imagem no bucket** de:
```
ChatGPT Image 20 de mar. de 2026, 12_05_13 (1).png
```
para:
```
influlab-logo.png
```

Nova URL ficaria limpa:
```
https://api.influlab.pro/storage/v1/object/public/emails/imagens/influlab-logo.png
```

Vantagens:
- Sem espaços, vírgulas, parênteses → zero risco de parsing em qualquer cliente de email
- URL legível
- Fácil de manter

## Saída

Após o diagnóstico, gero **`influlab-email-templates-v3.zip`** com os 5 templates apontando pra URL nova (`influlab-logo.png`), pronto pra você:
1. Renomear o arquivo no bucket Storage
2. Subir os 5 HTMLs no bucket
3. Apontar no GoTrue

## O que NÃO faço

- Não toco no código do app
- Não envio email de teste (não temos GoTrue aqui — você testa no fluxo real)
- Não embuto base64 (Gmail bloqueia >100KB)
- Não uso ferramentas de email_domain (irrelevantes pro self-hosted GoTrue)

