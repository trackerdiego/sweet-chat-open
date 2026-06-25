# Sem mudanças — apenas confirmação

O fluxo de parcelamento já está implementado conforme combinado:

- **Plano anual + cartão**: 1x a 12x (`MAX_INSTALLMENTS = 12` em `src/lib/installments.ts`).
- **Rota Asaas**: parcelado usa `/payments` com `installmentCount` (assinaturas Asaas não suportam parcela nativa).
- **Liberação Premium**: depende do webhook `PAYMENT_CONFIRMED` da 1ª parcela. Demais 11 parcelas seguem cobrando mês a mês sem reabrir gate de acesso.

**Próximo passo**: aguardar o primeiro pagamento real anual parcelado para observar:
1. Tempo entre aprovação do cartão e chegada do webhook.
2. Se o `is_premium` é marcado corretamente após a 1ª parcela.
3. Se o `installmentId` é persistido pra rastrear as parcelas seguintes.

Nenhuma alteração de código será feita agora.
