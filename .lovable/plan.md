## Problema
Algumas saídas de IA (matriz, tools, tarefas, daily guide, script, chat) ainda usam "linguagem neutra" (ex.: "todes", "amigues", "@s", uso de "elu") ou termos sem gênero forçados. O usuário quer português brasileiro padrão, com gênero gramatical normal (masculino/feminino conforme a regra), em **todas** as funções de IA.

## Solução
Injetar uma regra global obrigatória diretamente no helper compartilhado `supabase/functions/_shared/gemini.ts`, de modo que **toda** function (matriz, tools, tarefas, guia diário, roteiros, chat, perfil de audiência, onboarding) herde a mesma proibição — sem ter que tocar em cada prompt individualmente.

### Edição única: `supabase/functions/_shared/gemini.ts`

1. Definir constante no topo do arquivo:
   ```ts
   const LANGUAGE_RULE = "REGRA OBRIGATÓRIA DE LINGUAGEM: Responda SEMPRE em português brasileiro padrão, usando gramática normativa e gênero gramatical convencional (masculino/feminino conforme a regra culta). É TERMINANTEMENTE PROIBIDO usar qualquer forma de 'linguagem neutra', 'linguagem inclusiva de gênero' ou neopronomes. NÃO use: 'todes', 'todxs', 'tod@s', 'amigues', 'elu', 'delu', '@', 'x' como marcador de gênero, nem terminações alternativas. Sempre que precisar se referir a pessoas em geral, use o masculino genérico ('todos', 'os usuários', 'os seguidores', 'eles') ou reescreva a frase de forma neutra naturalmente em português ('a galera', 'o público', 'quem te segue', 'a audiência').";
   ```

2. Em `callGeminiNative` (linha ~225) e em `callGeminiStream` (linha ~408), concatenar a regra **antes** do `systemInstruction` informado:
   ```ts
   const finalSystem = opts.systemInstruction
     ? `${LANGUAGE_RULE}\n\n${opts.systemInstruction}`
     : LANGUAGE_RULE;
   body.systemInstruction = { parts: [{ text: finalSystem }] };
   ```
   E aplicar **incondicionalmente** (sempre injeta, mesmo se a função não tiver passado systemInstruction).

### Por que centralizar em vez de editar cada prompt
- Cobre 100% das funções de IA atuais (matriz, tools, tarefas, guia, script, chat, perfil, onboarding) e qualquer nova function futura, sem manutenção repetida.
- Uma única alteração no arquivo evita esquecer alguma rota.
- Não muda lógica/negócio, só reforça estilo de saída.

### Deploy (VPS)
Como toda mudança é em edge function compartilhada, redeploy de todas as functions que importam o helper:

```bash
cd /root/app && git pull && ./scripts/deploy-selfhost.sh \
  generate-personalized-matrix generate-tools-content generate-daily-guide \
  generate-script generate-audience-profile ai-chat \
  start-tools-job start-task-examples-job start-daily-guide-job \
  start-script-job start-onboarding-run
```

### Fora do escopo
- Não vou reescrever prompts individuais (a regra global já cobre).
- Não vou mexer em frontend, banco, ou textos estáticos do app — esses já estão em português padrão.
- Sem migrations.