## Fix: input do login perde foco a cada tecla

### Causa
Em `src/pages/Auth.tsx`, o componente `Shell` é declarado **dentro** da função `Auth`. A cada `setState` (cada tecla digitada → `setEmail`/`setPassword`), o React cria um novo tipo de componente `Shell`, desmonta toda a subárvore e remonta. Resultado: o `<Input>` é destruído a cada keystroke, perde foco e parece impossível de escrever.

### Correção
Mover `Shell` para **fora** do componente `Auth` (declaração no escopo do módulo). Como ele usa apenas `children`, basta extrair — nenhum estado ou prop adicional necessário.

```tsx
// Fora do componente Auth
const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="landing-dark min-h-screen flex flex-col relative overflow-hidden">
    <InAppBrowserBanner />
    <div className="neon-orb" style={{ ... }} />
    <div className="neon-orb" style={{ ... }} />
    <div className="relative z-10 ...">
      <img src={logo} alt="Vyral Lab" className="..." />
      {children}
    </div>
  </div>
);

const Auth = () => {
  // ... resto igual
};
```

### Arquivos afetados
- `src/pages/Auth.tsx` — apenas mover a declaração do `Shell`. Nenhuma outra mudança de lógica, estilo ou estrutura.

### Fora do escopo
- Nada em hooks, Supabase, fluxo de referral, validações ou estilização neon.
