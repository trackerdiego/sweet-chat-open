## Problema

A matriz de 30 dias é montada com um framework **fixo de criador(a) de conteúdo pessoal**: pilares `Principal / Vida Real / Negócios / Lifestyle`, temas semanais viscerais (`OBJEÇÕES / FERIDAS / PECADOS / ESPERANÇA`) e "gatilhos" tirados do avatar psicológico. Não importa se você escreve "sou nutricionista" ou "tenho boutique de roupas em Fortaleza" — o motor sempre entrega posts de posicionamento/mindset, não conteúdo para vender produto/serviço. Isso explica o print do Dia 2 do Thalyson-teste: "Você NÃO é 'mais um'" em vez de "Look do dia com a peça X".

## Solução

Adicionar 1 passo no onboarding com 3 objetivos, e ramificar o motor da matriz por objetivo — cada um com seu preset de **pilares**, **temas semanais** e **regras de prompt**. O estudo visceral segue existindo (é útil pros 3 casos), mas deixa de ditar o formato dos posts quando o objetivo não é marca pessoal.

## Novo passo no onboarding

Entre "Descreva seu trabalho" (passo 2) e "Estilo de conteúdo" (hoje passo 3), inserir passo com 3 cards:

| ID | Rótulo | Descrição |
|---|---|---|
| `sell_products` | Vender produtos da minha loja | Loja física ou online, boutique, marca própria, dropshipping, artesanato |
| `attract_clients` | Atrair clientes pro meu serviço | Nutri, advogado, personal, dentista, arquiteto, consultor, coach |
| `personal_brand` | Construir marca pessoal como criador | Influenciador, criador de nicho, especialista compartilhando conhecimento |

Barra de progresso vira 4 segmentos. Validação: obrigatório escolher 1.

## Presets por objetivo (motor da matriz)

Cada objetivo tem seu quarteto de pilares e sua progressão semanal. Todos continuam sendo 30 dias / 4 semanas / rotação de pilares. Muda o **conteúdo** dos pilares e o **tema** de cada semana.

### `sell_products` — LOJA
- **Pilares**: `produto` (Produto em Destaque) · `prova` (Prova Social/Cliente) · `bastidor` (Bastidor/Curadoria) · `oferta` (Oferta/Novidade)
- **Semanas**: S1 Vitrine e desejo de compra · S2 Confiança e prova social · S3 Autoridade e curadoria · S4 Urgência e conversão
- **Regra de prompt**: hooks vendem uma peça/coleção; storytelling mostra o item em uso, a origem (garimpo, fornecedor), o resultado na cliente; CTA leva pro direct/link/loja; visualInstructions sempre mencionam o produto em cena. Proibido post 100% mindset ou "sua jornada como empreendedora".

### `attract_clients` — SERVIÇO
- **Pilares**: `dor` (Diagnóstico da Dor) · `metodo` (Método/Diferencial) · `caso` (Caso Real/Antes-Depois) · `educacao` (Educação/Mito vs Verdade)
- **Semanas**: S1 Reconhecer a dor · S2 Educar sobre o método · S3 Provar com casos · S4 Convite pra consulta/orçamento
- **Regra de prompt**: hooks começam pela dor do cliente ideal; storytelling posiciona o método próprio; CTA leva pra agendar/DM/formulário. Estudo visceral alimenta as dores.

### `personal_brand` — CRIADOR
- **Pilares e semanas atuais** (mantém tudo como está hoje). É o único caso em que o framework visceral vigente faz sentido de ponta a ponta.

## Persistência

Nova coluna `user_profiles.business_goal text` com CHECK constraint aceitando os 3 IDs. Default para linhas existentes: `personal_brand` (preserva comportamento atual pra quem já completou onboarding).

SQL (rodar no Studio self-hosted — Lovable migrations não chegam lá):

```sql
alter table public.user_profiles
  add column if not exists business_goal text
    check (business_goal in ('sell_products','attract_clients','personal_brand'));

update public.user_profiles set business_goal = 'personal_brand' where business_goal is null;
```

Não precisa mexer em RLS/GRANTs — coluna nova em tabela existente herda tudo.

## Detalhes técnicos

Arquivos a mudar:

1. **`src/pages/Onboarding.tsx`**
   - Adicionar state `businessGoal` (default `''`).
   - Novo array `businessGoals` (3 opções acima).
   - Renderizar novo `<motion.div>` como `steps[2]`, empurrar estilo pra `steps[3]`.
   - Trocar barra de progresso `[0,1,2]` → `[0,1,2,3]` e ajustar comparação `step < 3` / `s + 1`.
   - Estender `canAdvance()` com `step === 2 → !!businessGoal`.
   - Passar `businessGoal` em `handleFinish` e `handleRetry` no payload do `start()`.

2. **`src/hooks/useOnboardingRun.ts`** (verificar): adicionar `businessGoal` no tipo do payload de `start`.

3. **`supabase/functions/start-onboarding-run/index.ts`**
   - Aceitar `businessGoal` no body do handler; validar `in ('sell_products','attract_clients','personal_brand')`, default `personal_brand`.
   - Salvar `business_goal` no upsert de `user_profiles` da Etapa 1.
   - Refatorar constantes: transformar `PILLARS` e `WEEKS` em `PRESETS_BY_GOAL[goal] = { pillars, weeks, matrixSystemHeader, buildFallbackTitle }`.
   - Em `buildSystem(week)` e `buildFallbackDescription/Avatar`, ler o preset correto por `input.businessGoal`.
   - `distributeVisceralElements` continua igual (o avatar visceral segue útil pros 3 fluxos), mas os "gatilhos" viram *insumo* pro pilar do dia em vez de tema principal.
   - Bump `FUNCTION_VERSION` pra `2026-07-04-goal-presets`.

4. **Deploy VPS** (fim da entrega, bloco copia-e-cola):
   ```bash
   cd /root/app && git pull && ./scripts/deploy-selfhost.sh start-onboarding-run
   ```
   E SQL do `business_goal` colado à parte pro Studio.

## Fora do escopo

- Reprocessar matriz de quem já completou onboarding (fica como `personal_brand`; se quiser trocar, usa o botão de reset existente).
- Mudar UI da matriz/script pra refletir novos pilares (tags "Produto/Prova/Oferta" na Matrix já aparecem automaticamente porque o `pillarLabel` vem do backend). Se algum componente estiver hard-coded pros 4 pilares antigos, ajusto no build.
- Ajustar `generate-script` e `generate-daily-guide` pra respeitar o goal — proponho fazer **depois**, num segundo passe, pra manter esse PR focado. Sem isso, o script gerado sob demanda ainda pode voltar ao tom visceral; a matriz base já vem certa.
