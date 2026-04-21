

# Plano: remover de vez o “segundo plano” e destravar o cakerollguide@gmail.com

## O problema exato

A tela do print vem de `src/pages/Index.tsx`:

```text
Finalizando sua matriz personalizada…
Aparece automaticamente em instantes. Você já pode explorar o app.
```

Isso é justamente a abordagem de “segundo plano” que deveria ter sido removida. Pior: ela só faz polling esperando a matriz aparecer; ela **não dispara a geração**. Então se o usuário está com:

```text
onboarding_completed = true
sem user_strategies válido
```

ele fica preso no dashboard com matriz base e banner infinito.

Além disso, a proteção atual ainda está incompleta: o app decide se o usuário precisa de onboarding olhando só para `user_profiles.onboarding_completed`. Ele não valida se a matriz realmente existe.

## Correção principal

### 1. Criar uma trava real de integridade no login/app

Alterar `useUserProfile` para, ao carregar o perfil, validar:

```text
Se onboarding_completed = true
E não existe user_strategies.strategies com pelo menos 28 itens
→ corrigir automaticamente onboarding_completed = false
→ manter/voltar usuário para /onboarding
```

Assim, mesmo que qualquer versão antiga, bug, clique em “continuar”, ou estado parcial deixe o usuário como `true`, o app se autocorrige.

Critério de matriz válida:

```text
Array.isArray(strategies) && strategies.length >= 28
```

Uso `>= 28` porque a própria edge function hoje aceita mínimo de 28 antes de salvar, embora o ideal seja 30.

### 2. Remover o banner de “finalizando em segundo plano”

Em `src/pages/Index.tsx`, remover completamente o bloco:

```text
!hasPersonalized && profile?.onboarding_completed && profile?.description_status === 'ok'
```

Esse banner passa a mensagem errada e mascara o problema. Se não tem matriz personalizada válida, o usuário não deve ficar explorando o app esperando algo que não está sendo gerado; ele deve voltar para o onboarding.

### 3. Remover polling de personalização em `useUserStrategies`

Simplificar `src/hooks/useUserStrategies.ts`:

- Carrega `user_strategies`
- Se tiver matriz válida, usa personalizada
- Se não tiver, usa fallback apenas como segurança visual
- Não exibe estado de “personalizando”
- Não fica 5 minutos fazendo polling esperando geração em background

A geração passa a acontecer somente no pipeline visível do onboarding.

### 4. Fortalecer o onboarding para nunca marcar completo sem matriz

Em `src/pages/Onboarding.tsx`:

- Manter `onboarding_completed = true` apenas depois do pipeline completo
- Antes de marcar completo, consultar `user_strategies` e validar `strategies.length >= 28`
- Se a matriz não existir ou for inválida, não marcar completo; deixar etapa `matrix` em erro com botão “Tentar novamente”
- Remover ou alterar o botão “Continuar mesmo assim” para **não** marcar onboarding como completo sem matriz

Fluxo final:

```text
Usuário termina formulário
        ↓
Pipeline visível:
1. Análise do público
2. Estudo visceral
3. Matriz de 30 dias
        ↓
Só se user_strategies válido existir:
onboarding_completed = true
        ↓
Vai para /
```

Se falhar:

```text
Fica no onboarding
mostra etapa com erro
botão "Tentar novamente"
não entra no dashboard incompleto
```

### 5. Corrigir o usuário cakerollguide@gmail.com no banco

Como o backend é Supabase self-hosted, isso precisa ser rodado manualmente no SQL Editor do self-hosted:

```sql
update public.user_profiles
set onboarding_completed = false,
    description_status = 'pending'
where user_id = (
  select id from auth.users where email = 'cakerollguide@gmail.com'
);

delete from public.audience_profiles
where user_id = (
  select id from auth.users where email = 'cakerollguide@gmail.com'
);

delete from public.user_strategies
where user_id = (
  select id from auth.users where email = 'cakerollguide@gmail.com'
);
```

Depois disso, esse usuário volta obrigatoriamente para o onboarding e refaz o processo.

## Arquivos que serão alterados

- `src/hooks/useUserProfile.ts`
  - adiciona validação de integridade: `onboarding_completed=true` só vale se existir matriz válida

- `src/pages/Index.tsx`
  - remove o banner de “Finalizando sua matriz personalizada…”

- `src/hooks/useUserStrategies.ts`
  - remove polling/background personalization
  - valida matriz por tamanho mínimo antes de considerar personalizada

- `src/pages/Onboarding.tsx`
  - impede marcar onboarding completo sem matriz válida
  - remove caminho de “continuar mesmo assim” que prende usuário sem dados
  - mantém retry visível da etapa que falhou

## O que não muda

- Prompts
- Edge functions
- Modelos Gemini
- SQL de schema
- RLS
- Fluxo de pagamento
- Painel admin

## Deploy

Como a correção de código é frontend-only:

```bash
# VPS: nada para edge functions
# Vercel: auto-deploy pelo GitHub
```

Mas, por regra do projeto, após o código sincronizar no GitHub, o bloco seguro para a VPS é:

```bash
cd /root/app && git pull origin main
```

Não precisa rodar:

```bash
./scripts/deploy-selfhost.sh
```

porque nenhuma edge function será alterada.

## Resultado esperado

- O app nunca mais deve mostrar “finalizando em segundo plano” como solução principal
- Usuário sem matriz válida não entra no dashboard como se estivesse completo
- `onboarding_completed=true` passa a significar: “perfil + matriz personalizada realmente prontos”
- O cakerollguide@gmail.com volta para o onboarding após o SQL manual
- Se a geração falhar, o usuário vê exatamente a etapa que falhou e tenta novamente ali

