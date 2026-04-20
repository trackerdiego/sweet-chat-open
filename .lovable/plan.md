
User reportou: recebeu push "você tem acesso a tudo" sendo usuário free com limites esgotados — mensagem conflita com a realidade. Quer revisar as mensagens.

Já tenho o `scheduled-push/index.ts` em contexto. Vou mapear os problemas reais nas mensagens.

## Diagnóstico das mensagens atuais

Analisei os 5 segmentos x 3 blocos = 90 mensagens. Encontrei **3 categorias de problema**:

### 1. Mensagens enganosas no segmento errado (graves)

No `FREE_EARLY` (usuário free dias 1-4 ainda com cota):
- afternoon[2]: **"🏆 Você tem acesso total / Scripts, IA, transcrição — use tudo que é seu!"** → **MENTIRA**. Free não tem acesso total. Esse texto é cara de PREMIUM colado no segmento errado.
- afternoon[4]: "⭐ Lembrete premium:" → mesma coisa, parece direcionado a premium.

No `PREMIUM`:
- afternoon[2]: "🏆 Você tem acesso total / use tudo que é seu!" → ok pra premium, mas é literalmente a MESMA string que tá no FREE_EARLY. Provavelmente foi o que o user recebeu.

### 2. Classificação falha que joga free no balde errado

A função `classifyUser` tem ordem problemática:
```
1. is_premium → PREMIUM
2. streak===0 && day>1 → FREE_INACTIVE
3. isExhausted → FREE_EXHAUSTED  ← exige TODOS os 3 limites zerados
4. day 5-7 → FREE_TRIAL_END
5. else → FREE_EARLY
```

Problemas:
- `isExhausted` só dispara se script + tools + transcrição **TODOS** zerados simultaneamente. Quem esgotou só scripts (caso comum) cai em `FREE_EARLY` e recebe "use tudo que é seu" — **exatamente o bug do user**.
- `FREE_INACTIVE` (streak=0 && day>1) atropela quem tá no dia 2 sem ter completado o dia 1 ainda — pessoa novinha vira "sentimos sua falta".
- Após dia 7 free vira `FREE_EARLY` de novo (não cai em nenhuma condição), recebendo "Dia 12 te espera!" — mas free nem tem acesso ao dia 12.

### 3. Tom inconsistente

Algumas free messages usam "premium", "elite", "acesso total" como adjetivos motivacionais — confunde com status real.

## Correções propostas

**A. Fix imediato da classificação (`classifyUser`)**

```text
1. is_premium → PREMIUM
2. !is_premium && day > 7 → FREE_LOCKED (novo segmento — passou do trial)
3. !is_premium && (script>=3 OR tools>=3 OR transcr>=1) → FREE_EXHAUSTED
   (mudar AND→OR: esgotou QUALQUER limite vira exhausted)
4. day 5-7 → FREE_TRIAL_END
5. inatividade real (last_active > 3 dias) → FREE_INACTIVE
   (precisa de um campo de last_seen — usar updated_at de user_progress)
6. else → FREE_EARLY
```

**B. Limpeza de copy nos pools**

- Remover de `FREE_EARLY`: as 2 frases "acesso total / use tudo que é seu" e "Lembrete premium" (substituir por copy honesto: "use suas 3 gerações de hoje", "guia gratuito do dia te espera").
- Adicionar novo pool `FREE_LOCKED` (dia 8+ sem premium) com tom de "seu acesso terminou, desbloqueia pra continuar" — hoje essa galera tá recebendo `FREE_EARLY` falando de "Dia 12" como se ainda tivesse acesso.
- Revisar `FREE_INACTIVE`: hoje é triggerado por streak=0 (qualquer pessoa que pulou um dia), não inatividade real. Suavizar tom ou trocar critério.

**C. Heurística mais segura na ausência de dados**

Hoje se `usage` ou `progress` vier null, cai em `FREE_EARLY` por default. Melhor: se não tem progress, mandar mensagem neutra (boas-vindas) em vez de "Dia 1 te espera" que pode estar errado.

## Entregáveis

1. Reescrever `supabase/functions/scheduled-push/index.ts`:
   - Atualizar `classifyUser` (lógica nova + buscar `updated_at` de user_progress pra detectar inatividade real)
   - Adicionar pool `FREE_LOCKED` (3 blocos x 6 msgs)
   - Limpar mensagens enganosas em `FREE_EARLY`
   - Suavizar `FREE_INACTIVE` (só dispara se updated_at > 3 dias)

2. Sem mudança no schema. Self-hosted: redeploy via `./scripts/deploy-selfhost.sh` depois.

3. Sem mudança no front.

## Resumo do que muda

| Antes | Depois |
|---|---|
| Free com 3 scripts gastos → "use tudo que é seu" | → "Você usou seus 3 scripts de hoje. Premium libera ilimitado." |
| Free dia 12 → "Dia 12 te espera, abre o app" | → "Seu acesso aos dias 8-30 está bloqueado. Desbloqueie." |
| Free dia 2 sem completar dia 1 → "Sentimos sua falta" | → mensagem normal de FREE_EARLY |
| isExhausted exige 3/3 limites zerados | qualquer 1 limite zerado já conta |
