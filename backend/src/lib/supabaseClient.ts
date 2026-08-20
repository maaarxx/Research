import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? ''

import { Request } from 'express'

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabaseClient] SUPABASE_URL or SUPABASE_ANON_KEY not set in backend/.env',
  )
}

// Client specifically for auth (verifying JWTs)
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)

// Create a client for the current request context (acts as the user, subject to RLS)
export function getSupabase(req: Request) {
  const auth = req.headers.authorization
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : ''
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
}
