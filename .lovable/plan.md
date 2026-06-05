# Fix: "Invalid API key" no login

## Causa raiz

O Lovable auto-populou `.env` com as credenciais do projeto Supabase Cloud dele:

```
VITE_SUPABASE_URL="https://gchncrlrmsyzumgmbplh.supabase.co"   ← Cloud Lovable (errado)
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ...gchncrlrmsyzumgmbplh..."  ← anon do Cloud
```

Mas `src/integrations/supabase/client.ts` lê:
- `VITE_SUPABASE_URL` → pega o **URL do Cloud Lovable**
- `VITE_SUPABASE_ANON_KEY` → **não existe no .env**, cai no fallback hard-coded do self-hosted

Resultado: URL aponta para `gchncrlrmsyzumgmbplh.supabase.co` e a key é a do `api.influlab.pro`. Mistura projetos → **invalid apikey**.

Isso é crítico porque o backend real do app é **self-hosted** (`api.influlab.pro`), e o Lovable Cloud não deve ser usado. Toda vez que o Lovable regenerar o `.env`, o problema volta.

## Fix

Reescrever `src/integrations/supabase/client.ts` para **hard-codar** URL e anon key do self-hosted, sem ler nenhuma `VITE_SUPABASE_*` do ambiente. Como o backend é fixo (api.influlab.pro), não há motivo para ler envs.

```ts
const SUPABASE_URL = "https://api.influlab.pro";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc2NTY3NjAwLCJleHAiOjE5MzQzMzQwMDB9.B5yEiG4ONDq_CSW9kIClLddKkKxNOEgLcsBNQYryJck";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
});
```

## Validação

1. Recarregar preview → tentar login → não deve mais retornar "invalid apikey".
2. Confirmar no DevTools (Network) que as chamadas vão para `https://api.influlab.pro/auth/v1/...` e retornam 200.

## Sem mudanças

- Nenhuma mudança em edge function, SQL, secrets, ou backend.
- Apenas 1 arquivo frontend.
