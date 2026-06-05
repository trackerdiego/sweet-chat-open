import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Backend é Supabase SELF-HOSTED. Valores hard-coded de propósito para
// evitar que o .env auto-gerado pelo Lovable (apontando para o Cloud)
// quebre o login com "invalid apikey".
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
