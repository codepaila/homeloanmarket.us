// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { postLoginRedirect, sanitizeCallbackUrl, roleHome } from '@/lib/auth-redirect'

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

export default async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret: AUTH_SECRET })
  const path = request.nextUrl.pathname

  if (path === '/auth/signin' && token) {
    return NextResponse.redirect(new URL(
      postLoginRedirect(token.role, request.nextUrl.searchParams.get('callbackUrl'), request.nextUrl.origin),
      request.url,
    ))
  }

  // Public paths that don't require authentication
  const publicPaths = [
    '/',
    '/auth/signin',
    '/auth/signup',
    '/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/error',
    '/auth/verify',
    '/auth/verify-email',
    '/brokers',
    '/brokers/[slug]',
    '/about',
    '/contact',
    '/faq',
    '/privacy',
    '/terms',
    '/subscription',
    '/guides',
    '/blog',
    '/calculator',
    '/claim-broker',
    '/api/auth',
    '/api/claims',
    '/api/brokers',
    '/api/cities',
    '/api/states',
    '/uploads',
    '/robots.txt',
    '/sitemap.xml',
  ]

  // Check if path is public
  const isPublicPath = publicPaths.some(publicPath => 
    path === publicPath || 
    path.startsWith('/api/auth') ||
    path.startsWith('/api/claims') ||
    path.startsWith('/uploads') ||
    path.startsWith('/brokers/') && !path.includes('/dashboard') ||
      path.startsWith('/api/brokers/') && !path.includes('/me') ||
      path.startsWith('/api/company/') ||
      path.startsWith('/api/contacts/send') ||
      path.startsWith('/api/ads') ||
      path.startsWith('/about') ||
    path.startsWith('/contact') ||
    path.startsWith('/faq') ||
    path.startsWith('/privacy') ||
    path.startsWith('/terms') ||
    path.startsWith('/subscription') ||
    path.startsWith('/guides') ||
      path.startsWith('/blog')
      || path.startsWith('/calculator')
      || path.startsWith('/claim-broker')
  )

  // Allow public paths
  if (isPublicPath) {
    return NextResponse.next()
  }

  // API routes that require authentication must return 401 JSON rather than a
  // login redirect so clients can handle the auth failure correctly.
  if (path.startsWith('/api')) {
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  // Redirect to login if no token
  if (!token) {
    const loginUrl = new URL('/auth/signin', request.url)
    loginUrl.searchParams.set('callbackUrl', sanitizeCallbackUrl(`${path}${request.nextUrl.search}`, request.nextUrl.origin) || '/')
    return NextResponse.redirect(loginUrl)
  }

  // Check user role and path permissions
  const userRole = token.role
  const isActive = token.isActive

  // Check if account is active
  if (!isActive) {
    return NextResponse.redirect(new URL('/auth/deactivated', request.url))
  }

  if (path === '/broker') {
    return NextResponse.redirect(new URL(roleHome(userRole), request.url))
  }

  // Admin routes
  if (path.startsWith('/admin')) {
    if (userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL(roleHome(userRole), request.url))
    }
  }

  // Broker routes
  if (path.startsWith('/broker')) {
    if (userRole !== 'BROKER') {
      return NextResponse.redirect(new URL(roleHome(userRole), request.url))
    }
  }

  // Dashboard routes
  if (path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL(roleHome(userRole), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - assets (public brand assets)
     * - uploads (advertisement media served by the uploads route handler)
     */
     '/((?!_next/static|_next/image|favicon.ico|public|assets|uploads).*)',
  ],
}
