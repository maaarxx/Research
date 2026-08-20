import { supabase } from './supabaseClient'

/**
 * Auth-aware fetch helpers.
 * Vite's /api proxy forwards these to http://localhost:4000 in development.
 * The Supabase JWT is attached automatically from the active session.
 */

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function apiUrl(path: string): string {
  // In production, we use VITE_API_URL to point directly to Render.
  // In dev, if VITE_API_URL is missing, it falls back to relative paths (using Vite proxy).
  const baseUrl = import.meta.env.VITE_API_URL || ''
  return `${baseUrl}${path}`
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(apiUrl(path), { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export async function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  const authHeaders = await getAuthHeaders()
  // Do NOT set Content-Type — browser sets it with the multipart boundary automatically.
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { ...authHeaders },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export async function apiDelete<T>(path: string): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(apiUrl(path), {
    method: 'DELETE',
    headers: { ...authHeaders },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}
