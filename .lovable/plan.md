# Plano: Reformular a experiência da aba Tarefas

## Diagnóstico

Hoje a aba `/tarefas` mostra dois blocos principais:

1. **Guia do Dia** (`DailyGuide.tsx`) — listas de Hooks, Storytelling, CTAs, Cliffhangers, Tipos de Conteúdo, Formatos de Vídeo, vindas de `src/data/dailyGuideContent.ts`.
2. **Cronograma do Dia** (`DailySchedule.tsx`) — blocos manhã/tarde/noite, cada tarefa com "exemplos" vindos de `src/data/dailySchedule.ts`.

Problemas reais:

- O conteúdo é **estático e idêntico pra todo usuário do mesmo pilar** (ex: "beleza" sempre vê os mesmos 5 hooks padrão); só muda o título do dia.
- A personalização real (IA Gemini) **só roda se o usuário clicar manualmente** em "✨ Gerar sugestões com IA" — a maioria nunca clica e fica com a base genérica.
- Os títulos das seções usam **jargão de copywriter** (Cliffhanger, Hook, CTA, Storytelling) que assusta usuário leigo.
- A mesma lógica genérica se repete dentro de cada horário do cronograma (exemplos rotacionados de um pool fixo).

## Estratégia

**Personalizar por padrão + linguagem popular + UX viciante**, sem quebrar a infra de jobs assíncronos já existente.

### 1. Auto-gerar conteúdo personalizado ao abrir a aba (1x por dia, cacheado)

- Nova tabela `daily_guide_cache` (`user_id`, `day`, `date`, `content jsonb`, `task_examples jsonb`) — uma linha por usuário/dia/data civil.
- No `Tasks.tsx`: ao montar, checar cache do dia atual. Se existir → renderiza direto. Se não existir → dispara `start-daily-guide-job` automaticamente em background com skeleton elegante ("Personalizando seu dia… ⚡") e faz polling.
- O worker já existente em `start-daily-guide-job` salva o resultado em `daily_guide_cache` antes de retornar (ajuste server-side).
- Usuários premium: regenera grátis a cada visita se quiserem (botão "🔄 Renovar sugestões"). Free: 1 geração/dia automática + cota atual mantida para regenerações manuais.
- Fallback: se a IA falhar, mostra o conteúdo estático atual como rede de segurança (sem travar a UX).

### 2. Rebatizar as seções com linguagem popular (PT-BR coloquial)

| Antes (jargão)               | Depois (popular)                        |
| ---------------------------- | --------------------------------------- |
| 🪝 Hooks Virais              | 👀 Frases que prendem a atenção         |
| 📖 Storytelling + Conexão    | 💬 Histórias que conectam               |
| 💰 CTAs de Conversão         | 🎯 Chamadas pra ação                    |
| 🔒 Cliffhangers / Ciclo do Vício | 🪤 Ganchos pro próximo conteúdo      |
| 🎬 Formatos de Vídeo         | 🎬 Como gravar (formatos prontos)       |
| 🎯 Tipos de Conteúdo         | 📱 O que postar hoje                    |

- Atualizar `dailyGuideContent.ts` (títulos das seções) + `DailyGuide.tsx` + `DailySchedule.tsx` (badge "Ciclo do Vício" → "Gancho do próximo post").
- Manter tooltip/`HelpButton` curto explicando o que cada bloco faz, sem termos técnicos.

### 3. UX da aba mais clara e viciante

- **Header do dia**: mostrar avatar do nicho + frase personalizada ("Hoje seu foco é: *{título do dia}*") + barra de progresso grande no topo (já existe parcialmente).
- **Card "Comece por aqui"** no topo: destaca a 1ª tarefa pendente do dia com CTA grande "Fazer agora" → rola até o bloco e expande. Reduz fricção de "por onde começo?".
- **Streak visível**: pequeno chip "🔥 Dia X seguido" ao lado do título — gatilho de retenção.
- **Confete + microcopy variável** ao completar cada tarefa (já tem confete; adicionar mensagens rotativas: "Bora pra próxima 💪", "Tá voando hoje ⚡"…).
- **Guia do Dia aberto por padrão** (hoje começa fechado) — usuário não precisa descobrir que existe.
- **Indicador "✨ Personalizado pra você"** em cada seção quando vem da IA (badge mais proeminente que o atual).
- Remover o botão "Diversificar sugestões dos horários" do meio do cronograma — fica redundante com o auto-gerar; movê-lo pro menu de ajustes do card como "🔄 Gerar outras ideias".

### 4. Fora de escopo (não vamos mexer agora)

- Lógica de cota (`tool_generations`) e paywall — mantida igual.
- Estrutura do `useInfluencer` / `useUserProgress` — só consumidores.
- Edge functions de outros fluxos (script, chat, tools).
- Backend self-hosted: vou entregar o SQL da nova tabela pra rodar manualmente no Studio (`api.influlab.pro`), conforme regra do projeto.

## Detalhes técnicos

**Arquivos a editar (frontend):**
- `src/pages/Tasks.tsx` — auto-fetch + polling do guia ao montar, skeleton, header "Comece por aqui".
- `src/components/DailyGuide.tsx` — abrir por padrão, renomear seções, badge "Personalizado", remover/reposicionar botão IA manual.
- `src/components/DailySchedule.tsx` — renomear "Ciclo do Vício" → "Gancho do próximo post", mover botão diversificar pra menu, microcopy de conclusão variável.
- `src/data/dailyGuideContent.ts` — atualizar `title` de cada `GuideSection` (mantém estrutura, só strings).
- `src/data/dailySchedule.ts` — renomear labels de tarefas com jargão (se houver).
- `src/hooks/useDailyGuideCache.ts` (novo) — encapsula leitura/escrita do cache + dispara job.

**Arquivos a editar (backend):**
- `supabase/functions/start-daily-guide-job/index.ts` — após gerar, fazer `upsert` em `daily_guide_cache`. Aceitar flag `force: true` pra regenerar ignorando cache.
- (Opcional) `supabase/functions/get-ai-job-status/index.ts` — sem mudança; só consumido.

**SQL pro user rodar no Studio self-hosted** (entrego no final da implementação como bloco copia-e-cola):

```sql
CREATE TABLE IF NOT EXISTS public.daily_guide_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day integer NOT NULL,
  date date NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  task_examples jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day, date)
);
ALTER TABLE public.daily_guide_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own cache" ON public.daily_guide_cache
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "service role manages cache" ON public.daily_guide_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

**Deploy:** frontend via Vercel (auto do GitHub). Edge function via `./scripts/deploy-selfhost.sh start-daily-guide-job` na VPS.

## Resultado esperado

- Usuário abre `/tarefas` → vê skeleton elegante por ~5-15s na primeira visita do dia → recebe conteúdo 100% personalizado (nicho + perfil de público + estilo + visceral element) sem clicar em nada.
- Visitas subsequentes no mesmo dia: instantâneo (cache).
- Linguagem que qualquer usuário entende, sem jargão.
- Sensação de "isso foi feito pra mim", não "é um template".

Pronto pra implementar quando você aprovar.
