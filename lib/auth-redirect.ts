export type AuthRole = 'ADMIN' | 'BROKER' | 'USER' | string | null | undefined

export const AUTHENTICATED_HOME = {
  ADMIN: '/admin',
  BROKER: '/broker/dashboard',
  USER: '/',
} as const

export function roleHome(role: AuthRole) {
  if (role === 'ADMIN') return AUTHENTICATED_HOME.ADMIN
  if (role === 'BROKER') return AUTHENTICATED_HOME.BROKER
  return AUTHENTICATED_HOME.USER
}

export function sanitizeCallbackUrl(value: string | null | undefined, baseUrl = 'https://example.test') {
  if (!value) return null
  const raw = value.trim()
  if (!raw || raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f]/.test(raw)) return null

  try {
    const base = new URL(baseUrl)
    const parsed = new URL(raw, base)
    if (parsed.origin !== base.origin) return null
    if (parsed.pathname === '/auth/signin' || parsed.pathname === '/auth/error') return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

function isAuthorizedDestination(path: string, role: AuthRole) {
  if (path === '/auth/signin' || path === '/auth/error') return false
  if (path === '/admin/dashboard' || path === '/dashboard') return false
  if (path === '/admin' || path.startsWith('/admin/')) return role === 'ADMIN'
  if (path === '/broker' || path.startsWith('/broker/')) return role === 'BROKER'
  return true
}

export function postLoginRedirect(role: AuthRole, callbackUrl?: string | null, baseUrl?: string) {
  const safePath = sanitizeCallbackUrl(callbackUrl, baseUrl)
  if (!safePath || !isAuthorizedDestination(safePath, role)) return roleHome(role)
  if (safePath === '/admin' || safePath === '/admin/dashboard') return role === 'ADMIN' ? AUTHENTICATED_HOME.ADMIN : roleHome(role)
  if (safePath === '/broker' || safePath === '/dashboard') return role === 'BROKER' ? AUTHENTICATED_HOME.BROKER : roleHome(role)
  return safePath
}
