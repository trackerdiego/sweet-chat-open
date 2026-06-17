// Tabela de juros do plano anual no cartão.
// Valor = % de acréscimo TOTAL sobre R$297 para N parcelas.
// Default: SEM JUROS até 12x (lojista absorve a taxa Asaas).
// Para repassar juros, ajuste os valores aqui (e a mesma tabela no
// edge function `create-asaas-subscription`). Ex Price 2,49% a.m.:
//   2: 2.49, 3: 4.98, ... ou use uma fórmula Price.
export const YEARLY_INTEREST_PCT: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
  7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
};

export const MAX_INSTALLMENTS = 12;
export const YEARLY_BASE_PRICE = 297;

export function calcInstallment(installments: number, base = YEARLY_BASE_PRICE) {
  const n = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(installments)));
  const pct = YEARLY_INTEREST_PCT[n] ?? 0;
  const total = +(base * (1 + pct / 100)).toFixed(2);
  const per = +(total / n).toFixed(2);
  return { installments: n, total, per, interestPct: pct, hasInterest: pct > 0 };
}

export function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
