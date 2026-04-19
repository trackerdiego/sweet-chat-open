

User is asking where to find `MIGRATION-FUNCTIONS.md`. Simple Q&A — no plan needed, but I'm in plan mode so I'll answer as a brief plan/info response.

The file is at the **root do repositório**, no mesmo nível do `package.json` e `README.md`.

## Como abrir

**Desktop (editor Lovable):**
1. Abrir o **Code Editor** (ícone `</>` no topo da preview, ou `Cmd+Shift+F` / `Ctrl+Shift+F`)
2. Na árvore de arquivos da esquerda, o `MIGRATION-FUNCTIONS.md` aparece logo no topo da raiz (junto com `README.md`, `package.json`, `index.html`)
3. Clicar pra abrir — o markdown renderiza no painel

**Mobile:**
1. Modo Chat → ícone `…` no canto inferior direito → **Code Editor**
2. Na sheet do file browser, é o primeiro `.md` da raiz
3. Toque pra abrir

**Via GitHub (se tiver o repo conectado):**
- `https://github.com/<seu-usuario>/<repo>/blob/main/MIGRATION-FUNCTIONS.md`

**Caminho completo no repo:** `./MIGRATION-FUNCTIONS.md` (raiz, não está dentro de `supabase/` nem `docs/`)

Lá dentro você acha:
- Lista das 14 functions (públicas vs privadas)
- Comandos do `deploy-selfhost.sh`
- **Bloco SQL** (seção "SQL pós-deploy") — é esse que você cola no SQL Editor do Studio depois do deploy
- Tabela de secrets esperadas
- Smoke tests com `curl`

Se preferir, posso colar o bloco SQL aqui no chat direto pra você não precisar abrir o arquivo.

