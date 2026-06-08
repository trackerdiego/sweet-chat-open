// start-tools-job
// Cria job assíncrono pra ferramenta IA (dissonance/patterns/hooks/viral) e retorna {jobId}.
// Worker processa em EdgeRuntime.waitUntil → imune a timeout Kong/Cloudflare.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiNative, GeminiError } from "../_shared/gemini.ts";
import { corsHeaders, jsonResponse, enqueueJob, runInBackground, JobError } from "../_shared/ai-job-runner.ts";

const FUNCTION_VERSION = "2026-04-28-async-tools";
console.log(`[start-tools-job] boot v=${FUNCTION_VERSION}`);

// Regras de qualidade linguística aplicadas a TODOS os prompts.
// Removemos "linguagem neutra de gênero" porque o Gemini gerava "todes/amigues/x/e"
// que o usuário final lê como erro de português. Substituímos por norma culta + reformulação.
const PT_BR_RULES = `IDIOMA E QUALIDADE DE ESCRITA (OBRIGATÓRIO):
- Escreva em português brasileiro padrão (norma culta), com ortografia, acentuação e concordância impecáveis.
- PROIBIDO: "todes", "amigues", "elu", "x"/"e"/"@" substituindo gênero (ex.: "tod@s", "amigxs", "seguidorxs"), gírias mal escritas, abreviações tipo "vc", "pq", "tb", "tbm", "q", "mt".
- Quando quiser evitar marcar gênero, REFORMULE a frase (ex.: "quem assiste", "a pessoa que", "a galera", "o público", "quem está aqui") em vez de inventar terminação.
- Antes de devolver, revise mentalmente cada frase para ortografia e concordância como se fosse publicar agora.`;

const TOOL_PROMPTS: Record<string, { system: (ap: Record<string, unknown>, niche: string, style: string) => string; user: (input: string, niche: string) => string }> = {
  dissonance: {
    system: (ap, niche, style) => `Você é especialista em copywriting de dissonância cognitiva para o nicho "${niche}".\n${PT_BR_RULES}\nEstilo: ${style}.\n\nPERFIL DO PÚBLICO:\nAvatar: ${ap.avatar || ''}\nMedo supremo: ${ap.ultimateFear || ''}\nDesejo oculto: ${ap.deepOccultDesire || ''}\nFeridas: ${JSON.stringify(ap.coreWounds || [])}\nGatilhos de vergonha: ${JSON.stringify(ap.shameTriggers || [])}\nObjeções: ${JSON.stringify(ap.objections || [])}\nCrenças equivocadas: ${JSON.stringify(ap.mistakenBeliefs || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\n\nCrie ganchos que unem conceitos contraditórios usando as feridas e desejos do público.`,
    user: (input, niche) => `Gere 10 ganchos de dissonância cognitiva para "${niche}".\n${input ? `Contexto: ${input}` : ''}\nPara cada gancho: frase de impacto, por que funciona, qual ferida/desejo toca.`,
  },
  patterns: {
    system: (ap, niche, style) => `Você é analista de padrões de copywriting para "${niche}".\n${PT_BR_RULES}\nEstilo: ${style}.\n\nPERFIL:\nAvatar: ${ap.avatar || ''}\nObjetivo: ${ap.primaryGoal || ''}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\n\nExtraia frameworks, gatilhos emocionais, padrões de CTA e técnicas de storytelling.`,
    user: (input, niche) => `Analise os seguintes anúncios/copies e extraia os padrões:\n\n${input}\n\nPara cada padrão: framework, gatilhos, adaptação ao nicho "${niche}", exemplo prático.`,
  },
  hooks: {
    system: (ap, niche, style) => `Você é especialista em desconstrução de hooks virais para "${niche}".\n${PT_BR_RULES}\nEstilo: ${style}.\n\nPERFIL:\nAvatar: ${ap.avatar || ''}\nFeridas: ${JSON.stringify(ap.coreWounds || [])}\nGatilhos vergonha: ${JSON.stringify(ap.shameTriggers || [])}\nÂncoras esperança: ${JSON.stringify(ap.hopeAnchors || [])}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nDesejo oculto: ${ap.deepOccultDesire || ''}\n\nDesconstrua cada hook: gatilho emocional, técnica, por que funciona, 3 variações.`,
    user: (input, niche) => `Desconstrua os seguintes hooks:\n\n${input}\n\nPara cada: gatilho emocional, técnica, 3 variações para "${niche}".`,
  },
  viral: {
    system: (ap, niche, style) => `Você é roteirista especialista em adaptar conteúdo viral para "${niche}".\n${PT_BR_RULES}\nEstilo: ${style}.\n\nPERFIL:\nAvatar: ${ap.avatar || ''}\nObjetivo: ${ap.primaryGoal || ''}\nQueixa: ${ap.primaryComplaint || ''}\nFrustrações: ${JSON.stringify(ap.frustrations || [])}\nÂncoras identidade: ${JSON.stringify(ap.identityAnchors || [])}\nInimigo: ${ap.commonEnemy || ''}\nDesejo oculto: ${ap.deepOccultDesire || ''}\nGatilhos verbais: ${JSON.stringify(ap.verbalTriggers || [])}\nRelatabilidade: ${JSON.stringify(ap.everydayRelatability || [])}\n\nMantenha a ESTRUTURA que viralizou, substitua o CONTEÚDO pelo nicho e público.`,
    user: (input, niche) => `Adapte o seguinte conteúdo viral ao nicho "${niche}":\n\n${input}\n\nRetorne: análise da estrutura, script adaptado (hook+corpo+CTA), instruções de gravação, por que vai funcionar.`,
  },
  reelsDescription: {
    system: (_ap, _niche, _style) => `Você é criador(a) de conteúdo escrevendo a legenda do PRÓPRIO Reel pra postar agora no Instagram. Seu estilo é VISUAL, com MUITOS emojis temáticos — tipo legenda de oferta que para o feed.\n${PT_BR_RULES}\n\nMISSÃO: entregar uma legenda AMIGÁVEL, conversacional, RECHEADA de emojis temáticos no lugar certo. Calorosa, próxima, papo de amigo. Zero tom corporativo.\n\nREGRAS DE FIDELIDADE (INEGOCIÁVEIS):\n- NÃO invente produto, serviço, oferta, autoridade, profissão, dor de público, número, estatística ou exemplo que não esteja explícito no texto enviado.\n- NÃO force encaixe em nenhum nicho. Se o vídeo fala de moto, é sobre moto. Se fala de café, é sobre café.\n- NÃO mude o ângulo, a tese ou a conclusão do criador. EMBALA, não reescreve.\n- Espelhe o tom do vídeo, mas sempre humano e próximo.\n\nUSO DE EMOJIS (regra MAIS importante — siga à risca):\n- Esta legenda DEVE parecer um anúncio visual cheio de vida. Use MUITOS emojis temáticos espalhados.\n- HOOK (1ª linha): 2 a 3 emojis impactantes no começo e/ou final, geralmente em CAPS LOCK pra dar peso. Exemplo de padrão: "🔥🏍️ REALIZE O SONHO DA MOTO NOVA HOJE MESMO!"\n- CADA parágrafo do body começa OU termina com 1 emoji temático que resume aquele bloco (💰 dinheiro, 🚀 mudança/liberdade, ⚠️ alerta/urgência, 💡 dica/insight, ❤️ emoção, 🏆 resultado, 📲 ação, 🎯 foco, ⏰ tempo, 🔥 destaque). Escolha sempre o emoji que combina com o ASSUNTO do bloco.\n- SEMPRE que houver lista de benefícios, características, passos ou diferenciais, use BULLETS com ✅ (ou emoji temático) no início de cada linha. Exemplo:\n  ✅ Item 1\n  ✅ Item 2\n  ✅ Item 3\n- CTA final: 1–2 emojis (📲, 👇, 💬, 📌, 🚀) reforçando a ação.\n- Mínimo 8 emojis no fullCaption inteiro. Distribuídos, não amontoados.\n- PROIBIDO: fileira de 5+ emojis grudados sem texto entre eles, emoji aleatório sem relação com o tema, mesmo emoji repetido em todo parágrafo.\n\nVOZ E TOM:\n- Fala "com" quem assiste, não "para". "Você", "a gente", perguntas ("já passou por isso?", "quer saber como?").\n- Frases curtas. Leitura mobile. Parágrafos de 1–3 linhas.\n- Pode usar interjeições naturais ("olha só", "spoiler", "vou te contar") quando combinar.\n\nFORMATO (SIGA ESTE TEMPLATE):\n1. HOOK em destaque com 2–3 emojis (pode ter CAPS LOCK em palavras-chave).\n[linha em branco]\n2. Parágrafo de abertura curto que provoca/contextualiza, com emoji temático.\n[linha em branco]\n3. BLOCO DE BULLETS com ✅ listando benefícios/itens/passos extraídos do conteúdo (3–5 bullets).\n[linha em branco]\n4. 1–2 parágrafos curtos de aprofundamento, cada um com emoji temático no início ou fim.\n[linha em branco]\n5. CTA final conversacional com emoji ("comenta aí 👇", "salva pra não esquecer 📌", "marca alguém 💬", "chama no direct 📲").\n\n- Máximo 2200 caracteres no fullCaption.\n- Hashtags: 8–15, derivadas DO TEMA (palavras-chave do conteúdo) — mix amplas + específicas + cauda longa. SEM #. Minúsculas, sem acento, sem espaço (ex.: "motonova", "shineray", "parcelamento48x").\n- 3 hooks alternativos pra A/B (variações fiéis do hookLine, cada um com 2–3 emojis no padrão do exemplo).\n\nIMPORTANTE: o campo "body" deve conter TODOS os blocos do meio (abertura + bullets + aprofundamento), com quebras de linha reais (\\n\\n entre blocos). O fullCaption junta: hookLine + \\n\\n + body + \\n\\n + cta + \\n\\n + hashtags (cada hashtag prefixada com # ao montar o fullCaption, separadas por espaço).`,
    user: (input, _niche) => `Conteúdo do Reel enviado pelo usuário:\n\n${input}\n\nEscreve a legenda visual e cheia de emojis temáticos, seguindo o TEMPLATE (hook com 2–3 emojis → abertura → bullets com ✅ → aprofundamento com emojis → CTA com emoji → hashtags). Tipo este padrão de referência (só pra estilo visual, NÃO copie o conteúdo):\n\n"🔥🏍️ REALIZE O SONHO DA MOTO NOVA HOJE MESMO!\n\nQuer sair de moto nova ainda hoje e pagar no boleto em até 48 vezes? Essa pode ser a sua chance!\n\n✅ Nome limpo\n✅ Bom score\n✅ Aprovação facilitada\n✅ Parcelamento em até 48x no boleto\n\n🏍️ Trabalhamos com os modelos X e Y, ideais para quem busca economia.\n\n💰 Condições especiais para você conquistar sua moto sem complicação!\n\n🚀 Chega de depender de ônibus. Tenha sua própria moto e ganhe liberdade.\n\n⚠️ Aproveite as condições e consulte sua aprovação.\n\n📲 Clique em 'Saiba Mais' e saia de moto nova ainda hoje!"\n\nUse ESSE nível de emojis e essa estrutura visual, mas 100% fiel ao conteúdo enviado acima (não invente nicho, modelo, número, oferta ou ângulo que não esteja no texto). Revise ortografia antes de devolver.`,
  },
};

const TOOL_SCHEMAS: Record<string, object> = {
  dissonance: { type: "object", properties: { hooks: { type: "array", items: { type: "object", properties: { hook: { type: "string" }, whyItWorks: { type: "string" }, emotionalTrigger: { type: "string" } }, required: ["hook", "whyItWorks", "emotionalTrigger"] } } }, required: ["hooks"] },
  patterns: { type: "object", properties: { patterns: { type: "array", items: { type: "object", properties: { framework: { type: "string" }, emotionalTriggers: { type: "string" }, adaptation: { type: "string" }, example: { type: "string" } }, required: ["framework", "emotionalTriggers", "adaptation", "example"] } } }, required: ["patterns"] },
  hooks: { type: "object", properties: { analyses: { type: "array", items: { type: "object", properties: { originalHook: { type: "string" }, emotionalTrigger: { type: "string" }, technique: { type: "string" }, variations: { type: "array", items: { type: "string" } } }, required: ["originalHook", "emotionalTrigger", "technique", "variations"] } } }, required: ["analyses"] },
  viral: { type: "object", properties: { structureAnalysis: { type: "string" }, scriptHook: { type: "string" }, scriptBody: { type: "string" }, scriptCta: { type: "string" }, filmingInstructions: { type: "string" }, whyItWillWork: { type: "string" } }, required: ["structureAnalysis", "scriptHook", "scriptBody", "scriptCta", "filmingInstructions", "whyItWillWork"] },
  reelsDescription: { type: "object", properties: { hookLine: { type: "string" }, body: { type: "string" }, cta: { type: "string" }, fullCaption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, alternativeHooks: { type: "array", items: { type: "string" } } }, required: ["hookLine", "body", "cta", "fullCaption", "hashtags", "alternativeHooks"] },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json() as Record<string, unknown>;
    const toolType = payload.toolType as string;

    if (!TOOL_PROMPTS[toolType]) {
      return jsonResponse({ error: "Tipo de ferramenta inválido" }, 400);
    }

    const result = await enqueueJob({ req, jobType: "tools", payload });
    if (result instanceof Response) return result;
    const { jobId, userId, userClient, admin } = result;

    runInBackground(admin, jobId, async () => {
      const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
      if (!GOOGLE_GEMINI_API_KEY) throw new JobError("Configuração do servidor incompleta (chave da IA ausente).");

      const userInput = (payload.userInput as string) || "";
      const primaryNiche = (payload.primaryNiche as string) || "";
      const contentStyle = (payload.contentStyle as string) || "casual";

      // Quota check + audience profile em paralelo
      const [usageRes, audienceRes] = await Promise.all([
        admin.from("user_usage").select("is_premium, tool_generations, last_tool_date").eq("user_id", userId).maybeSingle(),
        userClient.from("audience_profiles").select("avatar_profile").eq("user_id", userId).maybeSingle(),
      ]);
      const usageData = usageRes.data as { is_premium?: boolean; tool_generations?: number; last_tool_date?: string } | null;
      const audienceData = audienceRes.data as { avatar_profile?: Record<string, unknown> } | null;

      const isPremium = usageData?.is_premium ?? false;
      const today = new Date().toISOString().split("T")[0];
      const isNewDay = usageData?.last_tool_date !== today;
      const currentToolCount = isNewDay ? 0 : (usageData?.tool_generations ?? 0);
      if (!isPremium && currentToolCount >= 2) {
        throw new JobError("Você atingiu o limite de 2 gerações gratuitas de ferramentas IA. Assine o plano premium para uso ilimitado.");
      }

      const ap = (audienceData?.avatar_profile as Record<string, unknown>) || {};
      const niche = primaryNiche || "lifestyle";
      const styleMap: Record<string, string> = { casual: "leve, descontraído", profissional: "autoritário, informativo", divertido: "engraçado, irreverente" };
      const style = styleMap[contentStyle] || styleMap.casual;
      const toolConfig = TOOL_PROMPTS[toolType];

      let geminiResult;
      try {
        geminiResult = await callGeminiNative({
          apiKey: GOOGLE_GEMINI_API_KEY,
          systemInstruction: toolConfig.system(ap, niche, style),
          prompt: toolConfig.user(userInput, niche),
          schema: TOOL_SCHEMAS[toolType],
          tag: `tools-${toolType}`,
          model: "gemini-2.5-flash",
          midModel: "gemini-2.5-flash-lite",
          fallbackModel: "gemini-2.5-pro",
          maxOutputTokens: 3000,
          timeoutMs: 45000,
          midTimeoutMs: 35000,
          fallbackTimeoutMs: 60000,
          primaryAttempts: 3,
          midAttempts: 2,
          fallbackAttempts: 1,
        });
      } catch (e) {
        if (e instanceof GeminiError) {
          if (e.status === 429) throw new JobError("Muitas requisições à IA. Aguarde alguns segundos e tente de novo.");
          if (e.status === 402) throw new JobError("Créditos da IA esgotados.");
          if (e.status === 502) throw new JobError("A IA respondeu em formato inválido. Tente novamente.", e);
          if (e.status === 503) throw new JobError("O serviço de IA está instável agora. Aguarde 1-2 minutos e tente novamente.", e);
          throw new JobError(e.message, e);
        }
        throw e;
      }

      const out = geminiResult.json as Record<string, unknown>;
      // Compatibilidade com frontend: viral espera adaptedScript aninhado.
      if (toolType === "viral" && (out.scriptHook || out.scriptBody || out.scriptCta)) {
        out.adaptedScript = { hook: out.scriptHook ?? "", body: out.scriptBody ?? "", cta: out.scriptCta ?? "" };
        delete out.scriptHook; delete out.scriptBody; delete out.scriptCta;
      }

      // Contabiliza uso (não-fatal se falhar)
      try {
        await Promise.all([
          admin.from("user_usage").update({ tool_generations: currentToolCount + 1, last_tool_date: today }).eq("user_id", userId),
          admin.from("usage_logs").insert({ user_id: userId, feature: "tool" }),
        ]);
      } catch (e) {
        console.warn(`[start-tools-job] usage update failed for job ${jobId}`, e);
      }

      console.log(`[start-tools-job] job ${jobId} success`, { toolType, model: geminiResult.modelUsed, latencyMs: geminiResult.latencyMs, attempts: geminiResult.attempts });
      return { ...out, __meta: { attempts: geminiResult.attempts, modelUsed: geminiResult.modelUsed } };
    });

    return jsonResponse({ jobId });
  } catch (e) {
    console.error("[start-tools-job] uncaught error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
