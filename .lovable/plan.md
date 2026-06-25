# Rebrand do Manual: Influ Lab → VyralLab

## O que muda
Regenerar o PDF `manual-expert-influlab.pdf` substituindo toda menção de marca de "Influ Lab" / "Influlab" para **VyralLab**.

## Pontos de substituição
- **Capa**: título "Manual da Expert — Influ Lab" → "Manual da Expert — VyralLab"
- **Rodapés** de todas as páginas (marca + URL)
- **Contracapa / CTA final** (assinatura da marca)
- **Corpo do texto**: qualquer referência a "Influ Lab" nas descrições de features
- **Metadata do PDF** (Title, Author)
- **Nome do arquivo**: `manual-expert-vyrallab.pdf`

## Como executar
1. Abrir o script `/tmp/build_manual.py` usado na geração anterior
2. Substituir todas as strings "Influ Lab" / "Influlab" / "influlab" pela grafia "VyralLab"
3. Reexecutar o script gerando `/mnt/documents/manual-expert-vyrallab.pdf`
4. QA visual: rodar `pdftoppm` em algumas páginas-chave (capa, sumário, 2 features aleatórias, contracapa) e confirmar que não sobrou nenhuma menção antiga
5. Entregar o novo PDF como artefato pra download

## Fora de escopo
- Não mexer em código do app, edge functions, ou qualquer arquivo do projeto
- Não alterar layout, tom, estrutura ou conteúdo das features — só a marca
