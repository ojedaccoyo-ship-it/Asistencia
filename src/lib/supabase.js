import { createClient } from '@supabase/supabase-js'

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

// Protección contra URLs inválidas puestas en Vercel por error
if (!supabaseUrl.startsWith('http')) {
  console.warn("⚠️ VITE_SUPABASE_URL es inválida. Usando placeholder temporal.");
  supabaseUrl = 'https://placeholder.supabase.co';
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper para simular tiempo real si no hay llaves configuradas
export const isSupabaseConfigured = () => {
  return supabaseUrl !== 'https://placeholder.supabase.co'
}
