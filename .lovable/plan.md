## Mudanças no `CheckoutModal`

### 1. Header com gradiente lilás (igual outras partes do app)

Já existe a classe `.gradient-header` em `src/index.css` (linha 142) usada em outras telas:
```css
background: linear-gradient(135deg, hsl(258 60% 55%), hsl(280 70% 45%));
color: white;
```

Aplicar essa mesma faixa lilás como **bloco sólido** no topo do `DialogContent`, em vez do "aurora" branco-claro com blur que está hoje:
- Faixa lilás full-width nas etapas **Dados**, **Pagamento** e **Resultado (PIX)**.
- Ícone da coroa em pill branco translúcido (`bg-white/15 backdrop-blur`) sobre o lilás.
- Título e descrição em branco/branco-80%.
- Barra de progresso (3 segmentos) em branco semitransparente; ativo = branco sólido.
- Cantos arredondados só no topo (`rounded-t-lg`), conteúdo abaixo continua no fundo claro do card.

Resultado: o modal abre com a mesma "assinatura visual" lilás do resto do app (Navigation, Landing, gradient-header de outras páginas), em vez do header esmaecido atual.

### 2. Fonte do título

Hoje o título usa `font-sans` (Inter bold). Para diferenciar e dar peso editorial premium ao checkout, vou usar **Sora** — moderna, geométrica, ótima legibilidade em branco sobre lilás, combina com o tom premium sem ser séria demais como serifa.

Passos:
- `bun add @fontsource/sora` (pesos 600 e 700).
- Importar em `src/main.tsx`: `import '@fontsource/sora/600.css'; import '@fontsource/sora/700.css';`
- Adicionar `fontFamily.display: ['Sora', 'Inter', 'sans-serif']` em `tailwind.config.ts`.
- Usar `font-display` no `DialogTitle` e também no rótulo do valor (`R$ 297`) dentro do `BonusStack` para hierarquia consistente.

(Se preferir reutilizar a `Playfair Display` que já está carregada e dar um tom mais editorial/luxo, é só trocar `font-display` por `font-serif` no título — sem instalar nada. Me avisa qual prefere; default vou de Sora.)

### Arquivos afetados

- `src/components/CheckoutModal.tsx` — troca do header e aplicação de `font-display` nos títulos.
- `src/components/checkout/BonusStack.tsx` — `font-display` no valor "Você paga R$ X".
- `tailwind.config.ts` — adição de `fontFamily.display`.
- `src/main.tsx` — imports do `@fontsource/sora`.
- `package.json` — dependência `@fontsource/sora`.

Sem mudanças em backend, sem migration, sem deploy de edge function.