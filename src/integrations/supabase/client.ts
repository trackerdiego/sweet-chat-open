import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Prioriza as variáveis de ambiente, usando as chaves reais do servidor como fallback de segurança
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://api.influlab.pro";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc2NTY3NjAwLCJleHAiOjE5MzQzMzQwMDB9.B5yEiG4ONDq_CSW9kIClLddKkKxNOEgLcsBNQYryJck";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
