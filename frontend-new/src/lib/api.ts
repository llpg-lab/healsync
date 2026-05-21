export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

export function getAuthToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('healsync_auth_token') || ''
}

export function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getAuthToken()
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: authHeaders(options.headers),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail || `HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}
