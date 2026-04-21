

# Plano: voltar à UX de etapas avançando + tornar a geração confiável

## Diagnóstico do que está quebrado

**1. A matriz não chega nem em 2 minutos** porque o `fireAndForgetPersonalization` faz 3 chamadas encadeadas no browser **depois** que o usuário já navegou para `/`. Quando isso acontece:

- O React desmonta `Onboarding` → a Promise `runChain()` continua viva no JS, mas...
- `keepalive: true` no `fetch` tem **limite de 64KB de body** e só é confiável para uma única request curta no `unload` da página, não para uma cadeia de 3 requests longas
- A primeira request (`description`) pode até chegar ao servidor, mas a `await` da segunda nunca executa porque o contexto da página foi descartado
- Resultado: descrição às vezes salva, avatar quase nunca, matriz nunca

**2. A UX ficou pior** porque o usuário entra no app sem feedback claro de progresso, só vê um banner genérico "personalizando..." que nunca termina.

## Solução: voltar ao fluxo de etapas, mas com cada etapa cabendo no timeout

### Arquitetura

```text
Onboarding (3 etapas de cadastro)
        ↓
"Começar Jornada" clicado
        ↓
Tela de progresso com 3 cards:
   [✓] Analisando seu público          ← invoke description (~30-50s)
   [✓] Estudo visceral profundo        ← invoke avatar (~30-50s)  
   [✓] Montando matriz de 30 dias      ← invoke matrix (~40-90s)
        ↓
Cada card vira verde quando termina, vermelho se falhar (com retry só daquele)
        ↓
Quando os 3 terminam → redireciona pro app com tudo pronto
        ↓
Se usuário fechar a aba no meio → próximo login retoma de onde parou
```

### Por que isso vai funcionar agora (sendo que não funcionava antes)

A versão anterior falhava porque:
- `description` + `avatar` rodavam **na mesma request** → 60-180s → estouro de gateway
- `matrix` fazia 4 chamadas `gemini-2.5-pro` em paralelo → estouro também

A versão nova funciona porque:
- Cada `invoke` do client é **uma única chamada** que cabe em <60s (já está com `timeoutMs: 55000` + fallback rápido pro flash)
- Se `pro` demorar, cai pro `flash` em ~55s e ainda devolve resposta válida
- A matriz já tem stagger de 800ms entre semanas + fallback flash por semana

### O que muda no código

**1. `src/pages/Onboarding.tsx`** — substitui `fireAndForgetPersonalization` por um **pipeline visível** com 3 etapas:

```text
status: 'idle' | 'audience' | 'visceral' | 'matrix' | 'done' | 'error'
errorStep: 'audience' | 'visceral' | 'matrix' | null
```

Após salvar perfil, mostra tela de progresso (substitui os 3 steps de cadastro) com:
- 3 cards verticais, cada um com ícone (loader/check/x) + título + descrição
- Card ativo tem loader animado e gradiente sutil
- Card concluído tem check verde
- Card com erro tem botão "Tentar novamente" que re-dispara só aquela etapa
- Quando os 3 terminam, redireciona em 1s com toast de sucesso

Se o usuário fechar a aba no meio:
- Etapas já concluídas ficaram salvas no banco
- Próximo login: `useUserProfile` detecta `onboarding_completed=false` → redireciona pra `/onboarding`
- O onboarding detecta etapas já feitas (consulta `audience_profiles` e `user_strategies`) e **pula direto pra etapa que falta**

**2. `src/hooks/useUserStrategies.ts`** — manter o polling como rede de segurança, mas reduzir intervalo pra 8s nos primeiros 30s (caso o usuário já esteja no dashboard quando a matriz finalizar por algum motivo).

**3. `src/pages/Index.tsx`** — remover o banner "Personalizando sua matriz..." porque agora a personalização termina **antes** de chegar no dashboard. Manter apenas como fallback se o usuário pulou onboarding manualmente.

**4. `supabase/functions/generate-audience-profile/index.ts`** — sem mudanças, já está correto (split em description/avatar com 55s timeout cada).

**5. `supabase/functions/generate-personalized-matrix/index.ts`** — sem mudanças, já está com stagger e timeout corretos.

### O que NÃO muda

- Prompts refinados (master copywriter, schema visceral 30+ campos): **idênticos**
- Modelo `gemini-2.5-pro` com fallback `flash`: **mantido**
- Schema da matriz (4 semanas com gatilhos viscerais): **idêntico**
- Banco: **nenhuma migration necessária**
- Edge functions: **nenhum redeploy necessário**

### UX final

```text
Etapa 1: Nome
Etapa 2: Descrição (≥80 chars)  
Etapa 3: Estilo
        ↓ "Começar Jornada"
Etapa 4: Pipeline visível
   ⏳ Analisando seu público...      [30-50s]
   ⏳ Construindo estudo visceral... [30-50s, inicia após 1 acabar]
   ⏳ Montando sua matriz de 30 dias... [40-90s, inicia após 2]
        ↓
✨ Tudo pronto! → redireciona pra /
```

**Tempo total**: ~100-180s, mas com **feedback contínuo** — o usuário vê progresso a cada etapa terminada, não fica olhando pra um spinner genérico.

### Tratamento de erros

Se a etapa 1 falhar:
- Card vermelho com mensagem amigável: *"Não conseguimos analisar agora. [Tentar novamente]"*
- Botão refaz só a etapa 1
- Após 2 retries falhando: mostra opção *"Continuar mesmo assim"* → marca onboarding completo, app abre com matriz base

Se etapa 2 ou 3 falhar:
- Mesmo padrão, retry só daquela etapa
- Etapas anteriores não são refeitas (descrição já salva, avatar já salvo)

### Arquivos tocados

- `src/pages/Onboarding.tsx` — refatora `handleFinish` + adiciona tela de progresso
- `src/hooks/useUserStrategies.ts` — ajuste menor no polling
- `src/pages/Index.tsx` — remove banner de personalização (vira fallback condicional)

### Deploy

Como **só frontend muda**, basta o auto-deploy do Vercel rodar quando o Lovable sincronizar com o GitHub. **Nada precisa rodar na VPS**, nenhum SQL, nenhum redeploy de função.

