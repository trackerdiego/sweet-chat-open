
User passou token + user_id. Plano direto: rodar 4 curls contra `https://api.influlab.pro/functions/v1/asaas-webhook` em modo execução.

## Teste end-to-end do webhook Asaas

**Token:** `272b56cf27a625d68c4d0dc80b00c18c58b780dbf2e0e5d6`
**User cobaia:** `6055fb72-9e7c-44b4-81a2-a1ac0f9faef3`

### Execuções

1. **Sem token** → esperado `401`
2. **Token errado** → esperado `401`
3. **PAYMENT_CONFIRMED com token correto** → esperado `200 {"received":true}` + `is_premium=true`
4. **SUBSCRIPTION_DELETED com token correto** → esperado `200` + `is_premium=false` (reverte)

### Critério "apto a receber assinatura"

- ✅ 1 e 2 retornam 401 (segurança ativa)
- ✅ 3 e 4 retornam 200
- ✅ User confirma no Studio self-hosted que `is_premium` virou `true` e voltou pra `false`

### Query de validação (você roda no Studio self-hosted entre os passos 3 e 4)

```sql
select user_id, is_premium, updated_at 
from public.user_usage 
where user_id = '6055fb72-9e7c-44b4-81a2-a1ac0f9faef3';
```

### Limitação

Não tenho acesso ao banco self-hosted (`api.influlab.pro`) — só vejo o retorno HTTP do webhook. A confirmação final do `is_premium` precisa ser feita por você no Studio. Se preferir, depois do passo 3 abre o app logado como esse user e vê se desbloqueou premium.

### Sem mudanças de código

Só execução de curl. Nada altera arquivos do projeto.
