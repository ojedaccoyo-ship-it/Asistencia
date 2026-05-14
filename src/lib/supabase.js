import { createClient } from '@supabase/supabase-js'

// Reemplaza estas URLs con las de tu proyecto de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper para simular tiempo real si no hay llaves configuradas
export const isSupabaseConfigured = () => {
  return supabaseUrl !== 'https://placeholder.supabase.co'
}
