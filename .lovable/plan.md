## Causa raiz

Em `src/components/HypeOfTheDay.tsx`, o hook `const [allOpen, setAllOpen] = useState(false)` está na **linha 85**, **depois** dos `if (loading) return ...` (linha 46) e `if (error || !items...) return ...` (linha 65).

Isso quebra as Rules of Hooks do React: nos primeiros renders (enquanto `loading=true`) o componente chama menos hooks; quando `items` chega e os early returns deixam de disparar, esse `useState` extra é montado → **"Rendered more hooks than during the previous render"** → React desmonta a árvore inteira → tela branca / travada.

## Correção

Mover `const [allOpen, setAllOpen] = useState(false)` para junto dos outros hooks no topo do componente (logo após `setCopied`), e remover a declaração da linha 85.

Diff conceitual:

```text
export function HypeOfTheDay() {
  const { items, loading, error, reload } = useDailyHype();
  const [open, setOpen] = useState<HypeItem | null>(null);
  const [copied, setCopied] = useState(false);
+ const [allOpen, setAllOpen] = useState(false);
  const { toast } = useToast();
  ...
  if (loading) return ...
  if (error || !items?.length) return ...

  const top = (items || []).slice(0, 5);
- const [allOpen, setAllOpen] = useState(false);   // ❌ remover
  return ( ... )
}
```

## Arquivos

- `src/components/HypeOfTheDay.tsx` — 1 edit (mover hook).

Sem mudança de comportamento, só ordem. Resolve o erro do console e a tela branca no preview e no mobile.