

# Plano: Detectar navegador in-app + Corrigir vazamento de email

## Problema 1: PWA impossivel de instalar via Stories

Quando alguem clica no link do InfluLab dentro do Instagram/TikTok/Facebook Stories, o app abre no **navegador interno** (WebView). Esse navegador nao tem botao de compartilhar nem suporte a instalacao PWA. O usuario fica preso.

### Solucao

Criar um componente `InAppBrowserBanner` que detecta se o usuario esta num navegador in-app e mostra um botao "Abrir no navegador" que redireciona para o navegador real do celular.

**Deteccao** (user-agent): navegadores in-app contem strings como `Instagram`, `FBAN`, `FBAV`, `Twitter`, `Line`, `TikTok`, `BytedanceWebview`.

**Acao**: No Android, usar `intent://` URL scheme para forcar abertura no Chrome. No iOS, instrucoes para copiar link e abrir no Safari (infelizmente iOS nao tem intent scheme universal).

**Onde aparece**: Fixo no topo, acima de tudo, nas paginas Landing e Auth (antes do login). Prioridade sobre o InstallBanner.

### Arquivos

- **Novo** `src/hooks/useInAppBrowser.ts` — hook que detecta WebView via user-agent
- **Novo** `src/components/InAppBrowserBanner.tsx` — banner com botao "Abrir no navegador"
- **Editar** `src/pages/Landing.tsx` — adicionar o banner
- **Editar** `src/pages/Auth.tsx` — adicionar o banner

---

## Problema 2: Email de outro usuario aparecendo no campo de senha

Isso **nao e um vazamento de dados do InfluLab**. E o **autopreenchimento do navegador** (autofill). Como o campo de email tem `id="email"` e `type="email"`, o navegador salva credenciais de outros usuarios que usaram o mesmo celular ou sugere emails de contas Google/iCloud sincronizadas.

### Solucao

Adicionar `autoComplete="off"` nos campos de email e senha da pagina Auth para evitar que o navegador preencha automaticamente com dados de outros usuarios.

### Arquivos

- **Editar** `src/pages/Auth.tsx` — adicionar `autoComplete="off"` nos Inputs de email e senha

