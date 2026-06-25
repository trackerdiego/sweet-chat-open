# Manual da Expert — Influ Lab (PDF Comercial)

Vou gerar um PDF diagramado, pronto pra mandar pra ela, com a identidade visual do Influ Lab (roxo/violeta, fundo escuro, tipografia serif nos títulos). O arquivo fica em `/mnt/documents/manual-expert-influlab.pdf` com tag `<presentation-artifact>` pra você baixar direto.

## Estrutura do documento

**Capa** — Logo + título "Manual da Ferramenta — Tudo que o Influ Lab faz e por que importa" + subtítulo "Guia interno para experts".

**Sumário** com 4 seções e cada funcionalidade listada.

**Para CADA funcionalidade**, o mesmo template de 1 página (ou 2 quando precisar):

```text
┌──────────────────────────────────────────────┐
│ [ÍCONE]  NOME DA FUNCIONALIDADE              │
│          tag: Diário / Setup / Extra         │
├──────────────────────────────────────────────┤
│ O QUE É (1 parágrafo curto, comercial)       │
│                                              │
│ 3 RAZÕES PRA USAR                            │
│   1. ...                                     │
│   2. ...                                     │
│   3. ...                                     │
│                                              │
│ APLICAÇÃO NO DIA A DIA                       │
│   Cenário prático de uso real                │
│                                              │
│ QUEBRA DE OBJEÇÕES                           │
│   "Mas eu já..."   → resposta                │
│   "Não tenho..."   → resposta                │
│   "E se..."        → resposta                │
└──────────────────────────────────────────────┘
```

## Funcionalidades cobertas (15 no total)

**1. Perfil & Estratégia (setup)**
- Onboarding / Análise Visceral (perfil psicológico de 30+ campos do público)
- Reset da Matriz (recomeçar estratégia do zero)

**2. Conteúdo Diário (núcleo de uso)**
- Matriz Estratégica 30 dias (calendário programático custom)
- Tarefas do Dia (5 exemplos práticos personalizados)
- Roteiros / Script Generator (roteiro pronto por dia)
- Guia Diário (6 categorias: ganchos, storytelling, CTAs, etc.)
- Visão Semanal (dashboard interativo da semana)
- Hype of the Day (tendência/insight diário)
- Mindset Pulse (frase motivacional rotativa)

**3. Ferramentas /tools (6 ferramentas IA)**
- Consultor IA (chat estratégico que já conhece o público dela)
- Descrição de Reels (tema/vídeo → legenda + hashtags)
- Ganchos de Dissonância (headlines impossíveis de ignorar)
- Extração de Padrões (frameworks ocultos de copies)
- Desconstrução de Hooks (por que hooks virais funcionam)
- Roubar Trend Viral (transcrição/vídeo → roteiro adaptado ao nicho)

**4. Extras (engajamento e monetização)**
- Carteira de Coins (1 coin = R$0,01, vira desconto automático)
- Indique e Ganhe (programa de indicação)
- Notificações Push (lembretes diários)
- Instalar como App (PWA com guia visual de instalação)

## Tom comercial/persuasivo

- Linguagem direta, sem jargão técnico — como se ela fosse vender pra cliente final.
- Razões focadas em **resultado** ("economiza 2h por dia", "tira o branco da página", "garante que o conteúdo bate na dor real").
- Objeções respondidas no tom "eu sei o que você está pensando, e aqui está o porquê de não ser problema".

## Detalhes técnicos

- **Stack**: ReportLab Platypus (Python) — controle fino sobre layout, fácil de iterar.
- **Identidade visual**:
  - Fundo branco off-white (#FAFAFA) pra economizar tinta na impressão.
  - Acentos roxo Influ Lab (#8B5CF6) em títulos, ícones e barras laterais.
  - Títulos em serif (Playfair-like via fonte padrão serif do ReportLab) + corpo sans-serif.
  - Cada card com barra lateral roxa + ícone unicode/emoji simples.
- **QA obrigatório**: depois de gerar, converto cada página em JPG via `pdftoppm`, inspeciono todas em busca de overflow, sobreposição, cortes — corrijo e re-renderizo até passar.
- **Saída**: `/mnt/documents/manual-expert-influlab.pdf` + `<presentation-artifact>` no chat.

Estimativa: ~20-25 páginas (capa + sumário + 15 fichas + contracapa com CTA tipo "qualquer dúvida, fala com o suporte").

Posso seguir?
