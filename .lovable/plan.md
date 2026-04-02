

# Ativar Premium para Bruna

## Usuária identificada
- **Nome:** Bruna
- **user_id:** `6066bf74-e0ba-4043-a783-ecf5c78da462`
- **Status atual:** `is_premium = false`

## Ação

Executar um UPDATE na tabela `user_usage` para definir `is_premium = true`:

```sql
UPDATE user_usage SET is_premium = true WHERE user_id = '6066bf74-e0ba-4043-a783-ecf5c78da462';
```

## Resultado
- Bruna terá acesso a todos os dias do programa (sem limite de 7 dias)
- Sem limites diários de gerações de script, ferramentas, transcrições e chat
- Poderá redefinir perfil sem paywall

