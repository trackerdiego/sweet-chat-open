## Ajuste no hero da Landing

Atualmente o ícone do WhatsApp está quebrando para uma nova linha em telas estreitas porque o `<span>` com o texto fica em um flex item separado do `<svg>`.

### Mudança
Em `src/pages/Landing.tsx` (bloco do subtítulo do hero, ~linha 167):

- Remover o wrapper `<span>` ao redor do texto.
- Renderizar o texto "Comunidade de membros ativa com muita estratégia nova todos os dias." diretamente dentro do `<p>`, seguido imediatamente pelo `<svg>` do WhatsApp como elemento inline.
- Trocar `flex items-center gap-2 flex-wrap` por classes que mantenham fluxo de texto natural: usar `inline` no SVG com `inline-block align-middle ml-2` para que ele acompanhe a última palavra ("dias.") na mesma linha sempre que houver espaço, sem forçar quebra.

Resultado: o ícone verde do WhatsApp aparece colado após "dias." na mesma linha do texto.

Nenhum outro arquivo é alterado.