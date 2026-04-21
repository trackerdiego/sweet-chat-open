

# Resposta: sim, matriz mockada temporária durante a análise

## Como vai funcionar

```text
Usuário finaliza onboarding
        ↓
Entra direto no app (sem espera)
        ↓
Dashboard mostra matriz PADRÃO (fallbackStrategies — já existe em src/data/strategies.ts)
        ↓
Em background: descrição → avatar → matriz personalizada
        ↓
Quando matriz personalizada salva → app troca automaticamente
```

## O que o usuário vê em cada momento

**Momento 1 — acabou de finalizar onboarding (0s):**
- Entra no dashboard
- Matriz dos 30 dias visível com conteúdo padrão (`fallbackStrategies`)
- Banner discreto no topo: *"Personalizando sua matriz com base no seu público... isso leva ~2 minutos"*
- Pode navegar, ler, marcar tarefas — tudo funciona

**Momento 2 — análise em andamento (30-90s):**
- Mesma matriz padrão visível
- Banner atualiza: *"Estudo do seu público pronto. Gerando matriz personalizada..."*

**Momento 3 — matriz personalizada pronta (~120s):**
- Banner some
- Toast: *"Sua matriz personalizada está pronta!"*
- Conteúdo dos 30 dias atualiza automaticamente (hook `useUserStrategies` re-fetch)
- Os dias que o usuário já viu/marcou continuam com progresso preservado (progresso é por número do dia, não por conteúdo)

## Por que isso funciona sem prejuízo

1. **`fallbackStrategies` já existe e já é usado** — o hook `useUserStrategies` já cai nele quando `user_strategies` está vazio. Não vou criar mock novo, só vou tornar essa transição visível e intencional em vez de "acidente de loading".

2. **Progresso é por dia (1-30), não por conteúdo** — quando a matriz personalizada chega, dia 1 continua sendo dia 1. Marcações, streak, pontos: tudo intacto.

3. **Pillar/estrutura é igual** — fallback e personalizada seguem o mesmo schema (`DayStrategy[]` com pillar, title, hook, tarefas). A troca é transparente visualmente.

## Detalhe importante sobre "mockada"

Não é mock no sentido de "dados falsos só pra preencher". É a **matriz base de 30 dias** original do app — a mesma que rodou durante todo o desenvolvimento antes de existir personalização. Conteúdo de qualidade, só não adaptado ao nicho específico do usuário.

## Polling automático

Adiciono polling leve no dashboard:
- A cada 15s, verifica se `user_strategies` foi populado
- Quando aparece → atualiza estado → mostra toast
- Para de pollar após sucesso ou após 5 minutos (timeout)

Custo: 1 query a cada 15s só durante a janela de geração. Para depois.

## Fallback de falha

Se a IA falhar de verdade (após retry interno):
- Banner muda pra: *"Não conseguimos personalizar agora. Você está usando a matriz base. [Tentar novamente]"*
- Botão de retry dispara só a etapa que falhou
- App continua 100% funcional com matriz base indefinidamente

## Resumo da sua pergunta

**Sim** — matriz base aparece imediatamente, usuário usa o app normal, e a personalizada substitui automaticamente quando fica pronta. Sem tela vermelha, sem espera, sem perda de qualidade nos prompts.

