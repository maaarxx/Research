import { createClient } from '@supabase/supabase-js'

// Fill these in a .env file at the frontend root:
//   VITE_SUPABASE_URL=...
//   VITE_SUPABASE_ANON_KEY=...
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
