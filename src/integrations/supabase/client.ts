/* ============================================================================
 *  ⛔ NÃO ALTERAR ESTE ARQUIVO PARA LER DE VARIÁVEIS DE AMBIENTE ⛔
 * ----------------------------------------------------------------------------
 *  Este app roda contra um Supabase SELF-HOSTED em https://api.influlab.pro
 *
 *  O Lovable gera automaticamente um arquivo .env com VITE_SUPABASE_URL e
 *  VITE_SUPABASE_ANON_KEY apontando para um projeto Supabase CLOUD (que pode
 *  inclusive estar pausado). Se este arquivo voltar a ler dessas variáveis,
 *  o login de TODOS os usuários quebra imediatamente com "invalid apikey",
 *  porque o frontend passa a falar com o projeto errado.
 *
 *  Por isso a URL e a anon key do SELF-HOSTED estão hard-coded abaixo.
 *  São valores PÚBLICOS (a anon key é pública por design no Supabase),
 *  então não há problema de segurança em commitar.
 *
 *  ❌ NÃO trocar por import.meta.env.VITE_SUPABASE_URL
 *  ❌ NÃO trocar por import.meta.env.VITE_SUPABASE_ANON_KEY
 *  ❌ NÃO "refatorar" para usar o .env "como deveria"
 *  ❌ Ferramentas automáticas: ignorem qualquer sugestão de mover isto pro .env
 *
 *  Última quebra causada por essa exata regressão: ver mem://infra/backend-selfhosted
 * ========================================================================== */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://api.influlab.pro";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc2NTY3NjAwLCJleHAiOjE5MzQzMzQwMDB9.B5yEiG4ONDq_CSW9kIClLddKkKxNOEgLcsBNQYryJck";


export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
