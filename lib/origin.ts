function allowedOrigins(): string[] {
  const values = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.AUTH_URL,
    process.env.NEXT_PUBLIC_URL,
    // Backward-compatible fallback; NOT an alternative source of truth for
    // authentication secrets. Present only so CSRF origin checks keep working
    // in environments that set only the legacy variable.
    process.env.NEXTAUTH_URL,
  ]
  const origins = values
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return new URL(value).origin
      } catch {
        return null
      }
    })
    .filter((value): value is string => Boolean(value))
  return Array.from(new Set(origins))
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false

  const origins = allowedOrigins()
  if (origins.length === 0) return false

  try {
    return origins.includes(new URL(origin).origin)
  } catch {
    return false
  }
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
