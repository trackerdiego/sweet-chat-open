## Objetivo
Melhorar a tool **Descrição de Reels** para gerar legendas mais amigáveis, conversacionais e com uso natural de emojis — mantendo fidelidade ao conteúdo enviado.

## Mudança única
Atualizar o prompt `reelsDescription.system` em `supabase/functions/start-tools-job/index.ts` (linha 39).

### Novo tom (resumo das diretrizes que entram no prompt)
- Voz de criador falando com a comunidade: calorosa, próxima, "papo de amigo", sem corporativês.
- Frases curtas, ritmo de Reels (1ª linha curta e impactante, leitura mobile).
- **Emojis SIM, com generosidade controlada**: 1 emoji na linha do hook, 1–2 por bloco/parágrafo, emojis temáticos (ex.: ☕ pra café, 💡 pra insight, 🔥 pra resultado), 1 emoji ancorando o CTA. Proibido fileira de 5+ emojis seguidos e emoji aleatório só pra enfeitar.
- Estrutura visual amiga do feed: blocos curtos separados por linha em branco, bullets com emoji quando listar.
- CTA conversacional ("comenta aí 👇", "salva pra não perder 📌", "marca alguém 💬") coerente com o tema.
- Mantém TODAS as regras de fidelidade já existentes (não inventar nicho, produto, número, ângulo).
- Mantém regra de hashtags (8–15, derivadas do tema, sem #, minúsculas, sem acento).
- Mantém `PT_BR_RULES` (sem "todes/amigues/vc/pq").
- Mantém 3 hooks alternativos pra A/B.

### O que NÃO muda
- Schema de saída (`hookLine`, `body`, `cta`, `fullCaption`, `hashtags`, `alternativeHooks`) — frontend continua igual.
- Função `start-tools-job` no resto, deploy via `./scripts/deploy-selfhost.sh` ou `docker compose restart functions` na VPS.
- Nenhuma mudança no frontend, schema, ou migrations.

## Entrega
Ao final, bloco copia-e-cola pra rodar na VPS reimplantando só `start-tools-job`.