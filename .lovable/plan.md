# Configurar SMTP manualmente no .env (modo seguro)

Você abre o `.env` no nano, procura cada seção e edita/adiciona à mão. Sem `sed`, sem `cat >>`. Mais lento, mas zero risco de duplicar variável ou cortar linha errada.

## Passo 1 — Backup + abrir

```bash
cd ~/supabase/docker
cp .env .env.bak.$(date +%F-%H%M%S)
nano .env
```

## Passo 2 — Procurar a seção SMTP (atalho `Ctrl+W` no nano)

Digite `SMTP` e Enter. Você vai cair numa de duas situações:

### Situação A — já existem variáveis `SMTP_*` ou `GOTRUE_SMTP_*`
Edite os valores existentes pra ficarem **exatamente** assim (não adicione duplicado):

```env
GOTRUE_SMTP_HOST=acesso.host.servidorsaturno.com.br
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=suporte@vyrallab.online
GOTRUE_SMTP_PASS=SUA_SENHA_REAL_AQUI
GOTRUE_SMTP_ADMIN_EMAIL=suporte@vyrallab.online
GOTRUE_SMTP_SENDER_NAME=Vyral Lab
```

Se existir alguma `SMTP_HOST=` / `SMTP_USER=` (sem o prefixo `GOTRUE_`), o template oficial do Supabase usa essas e injeta no GoTrue via `docker-compose.yml`. **Nesse caso edite essas, não crie as `GOTRUE_SMTP_*`** — senão duplica e fica imprevisível qual ganha.

> Pra descobrir qual o seu template usa, antes de salvar abra outro terminal:
> ```bash
> grep -E 'SMTP|MAILER' ~/supabase/docker/docker-compose.yml
> ```
> Se vir algo tipo `GOTRUE_SMTP_HOST: ${SMTP_HOST}` → seu .env usa **`SMTP_*`** (sem prefixo).  
> Se vir `GOTRUE_SMTP_HOST: ${GOTRUE_SMTP_HOST}` → usa **`GOTRUE_SMTP_*`** (com prefixo).

### Situação B — não existe nenhuma variável SMTP no .env
Aí sim, vai no final do arquivo (`Ctrl+End` ou setinha pra baixo até o fim) e adiciona o bloco acima usando o **mesmo prefixo do seu docker-compose** (resultado do `grep` acima).

## Passo 3 — Salvar

`Ctrl+O` → Enter (confirma nome) → `Ctrl+X` (sai)

## Passo 4 — Proteger permissão

```bash
chmod 600 .env
```

## Passo 5 — Subir o auth

```bash
docker compose up -d --force-recreate auth
docker compose logs --tail=100 auth | grep -iE 'smtp|mail|error|started'
```

## Passo 6 — Smoke test

1. `https://app.vyrallab.online/auth` → "Esqueci minha senha" → seu email
2. Conferir remetente `Vyral Lab <suporte@vyrallab.online>` + SPF/DKIM pass

---

## Antes de eu finalizar, me confirma 2 coisas:

1. Posso te pedir pra **rodar primeiro o `grep` do `docker-compose.yml`** e me colar a saída? Aí eu te falo com 100% de certeza se é `SMTP_*` ou `GOTRUE_SMTP_*` e te entrego o bloco final exato — sem chute.
2. **Porta 465 ok** ou prefere 587 desde o início?

Aprova e eu te mando o comando do grep.
