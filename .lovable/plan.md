## Causa raiz

No prompt do `reelsDescription` (em `supabase/functions/start-tools-job/index.ts`), a instrução `"Use linguagem neutra de gênero"` força o Gemini a produzir construções tipo **"todes"**, **"amigues"**, **"sigam-x"**, **"elu"** — que, apesar de intencionais, são lidas como erro de português pelo usuário final.

Outro agravante: o prompt não exige **norma culta de PT-BR**, ortografia oficial nem revisão final. Modelos de fallback (`flash-lite`) erram mais sem essa âncora.

## Correção

Reescrever **apenas o prompt** do `reelsDescription` no arquivo `supabase/functions/start-tools-job/index.ts`:

1. **Remover** `"Use linguagem neutra de gênero"`.
2. **Substituir** por bloco explícito de qualidade linguística:
   - "Escreva em **português brasileiro padrão (norma culta)**, com ortografia, acentuação e concordância impecáveis."
   - "Proibido: 'todes', 'amigues', 'x'/'e' substituindo gênero (ex.: 'tod@s'), gírias mal escritas, abreviações tipo 'vc/pq/tb'."
   - "Quando quiser evitar marcar gênero, **reformule** (ex.: 'quem assiste', 'a pessoa que', 'a galera') em vez de inventar terminação."
   - "Antes de devolver, **revise** ortografia e concordância como se fosse publicar agora."
3. Manter resto do prompt (regras de hook, hashtags, CTA, 2200 chars) intacto.
4. Aplicar a mesma higiene linguística (norma culta + sem neutralidade artificial) nos outros 4 prompts do mesmo arquivo (`dissonance`, `patterns`, `hooks`, `viral`) que **também têm** `"Use linguagem neutra de gênero"` — eles vão apresentar o mesmo bug em algum momento.

## Deploy

Só edge function muda. Frontend e schema intactos. Bloco copia-e-cola pra VPS no fim:

```bash
cd /root/app && git pull origin main && ./scripts/deploy-selfhost.sh start-tools-job
```

Sem SQL, sem migration.

## Arquivos afetados

- `supabase/functions/start-tools-job/index.ts` (única edição)
