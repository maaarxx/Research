import { Request } from 'express'
import { supabaseAnon } from './supabaseClient'

export interface AuthUser {
  id: string
  email?: string
}

/**
 * Extracts and validates the Supabase JWT from the Authorization header.
 * Throws an error with `status: 401` if the token is missing or invalid.
 */
export async function extractUser(req: Request): Promise<AuthUser> {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    const err = new Error('Missing or invalid Authorization header') as Error & { status: number }
    err.status = 401
    throw err
  }

  const token = auth.slice(7)
  const { data, error } = await supabaseAnon.auth.getUser(token)

  if (error || !data.user) {
    console.error('getUser error:', error, 'data:', data);
    const err = new Error('Invalid or expired token') as Error & { status: number }
    err.status = 401
    throw err
  }

  return { id: data.user.id, email: data.user.email }
}
