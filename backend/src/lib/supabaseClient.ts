import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabaseClient] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY not set — ' +
      'copy backend/.env.example to backend/.env and fill them in.',
  )
}

// Backend uses the service role key (never expose this to the frontend).
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// Client specifically for auth (verifying JWTs) because GoTrue rejects the service role key.
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
