## Redesign da tela de retenção (`PaywallScreen`)

A tela que aparece atrás do checkout (e que reaparece quando o user fecha o modal do PIX) ainda está no visual antigo: ícone de cadeado em círculo cinza, título em serifa preta, bullets de feature list **iguais** aos que já aparecem no `BonusStack` dentro do modal — repetição visual e perda de impacto.

### Direção: alinhar com a nova identidade do checkout + remover redundância

**1. Header lilás (mesma assinatura do modal)**
- Substituir o card branco neutro por um card com **topo em `gradient-header` lilás** (mesmo do `CheckoutModal`).
- Ícone `Crown` em pill branco translúcido (`bg-white/15 backdrop-blur ring-1 ring-white/30`) no lugar do cadeado cinza.
- Título em `font-display` (Sora) branco, descrição em branco/80%.

**2. Remover os 5 bullets de feature**
Os bullets `BULLETS` repetem o que o `BonusStack` mostra no modal. Tirar.

No lugar, usar **gatilhos de retenção** que o modal **não** mostra:

- **Prova social compacta**: linha única com avatares empilhados + "+2.847 criadores ativos esta semana".
- **Garantia de 7 dias**: bloco igual ao da imagem 1 que o user mandou (escudo + "7 dias de garantia / Se não amar, devolvemos 100%. Sem perguntas."). Reforça segurança sem repetir features.
- **Selo de pagamento seguro**: linha discreta "🔒 Pagamento processado pela Asaas · PIX e Cartão".

**3. CTA mais forte**
- Botão `gold-gradient` mantido, mas com microcopy mudada para algo direto: "Continuar para pagamento" + chevron, em vez de "Assinar agora" (o user já entendeu que vai assinar — agora é só voltar pro fluxo).
- Abaixo, link sutil "Sair da conta" mantido.

**4. Layout final (esqueleto)**
```text
┌─────────────────────────────────┐
│  [gradient lilás c/ Crown pill] │
│  Falta só o último passo        │
│  Finalize sua assinatura...     │
├─────────────────────────────────┤
│  [avatares] +2.847 criadores    │
│                                  │
│  🛡️ 7 dias de garantia          │
│  Se não amar, devolvemos 100%   │
│                                  │
│  [ Continuar para pagamento → ] │
│        Sair da conta            │
└─────────────────────────────────┘
```

### Arquivos afetados
- `src/components/PaywallScreen.tsx` — reescrita do JSX: remove `BULLETS`, troca header, adiciona bloco de garantia + prova social.

Sem mudanças em backend, sem migration, sem deploy de edge function. Frontend puro.
