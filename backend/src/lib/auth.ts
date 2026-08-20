import { Request } from 'express'
import { supabase } from './supabaseClient'

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
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    const err = new Error('Invalid or expired token') as Error & { status: number }
    err.status = 401
    throw err
  }

  return { id: data.user.id, email: data.user.email }
}
