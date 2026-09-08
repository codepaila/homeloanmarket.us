// proxy.ts — Next.js 16+ project routing boundary.
// (Filename was renamed from middleware.ts; do NOT create both.)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { postLoginRedirect, sanitizeCallbackUrl, roleHome } from '@/lib/auth-redirect'

// AUTH_SECRET is the single canonical authentication secret. Auth.js, this
// proxy, and every server-side session verifier MUST use the exact same value
// so the JWE session cookie can be decoded consistently across layers.
const AUTH_SECRET = process.env.AUTH_SECRET

// Auth.js computes its cookie prefix from the effective site URL protocol:
//   https: -> "__Secure-authjs.session-token"   (useSecureCookies = true)
//   http:  -> "authjs.session-token"            (useSecureCookies = false)
// getToken() defaults secureCookie to FALSE, so without passing it this proxy
// would look for the non-secure cookie name and always return null behind an
// HTTPS reverse proxy — causing every protected route to bounce to signin even
// though the browser holds a valid session cookie. Derive the flag the same
// way Auth.js does (AUTH_URL protocol), so both layers read the same cookie.
function secureSessionCookies(): boolean {
  const authUrl = process.env.AUTH_URL
  if (authUrl && /^https:\/\//i.test(authUrl)) return true
  if (authUrl && /^http:\/\//i.test(authUrl)) return false
  return process.env.NODE_ENV === 'production'
}

// ---------------------------------------------------------------------------
// PUBLIC PATH / ENDPOINT RULES
// ---------------------------------------------------------------------------
//
// The proxy only enforces a coarse authentication boundary. Each row below
// declares an exact public page or API path. When a method-aware rule is
// required (e.g. "GET only"), the matchers below evaluate both the path and
// the method. The set of public endpoints MUST stay narrow and explicit:
// server-side route handlers are still the authoritative authorization layer.
//
// The following is a structured summary of the current public path map:
//
//   PAGE PATHS (always GET)
//   /                              (home)
//   /auth/signin, /auth/signup     (auth entry)
//   /register, /company/register   (registration entry)
//   /auth/forgot-password, /auth/reset-password, /auth/error, /auth/verify,
//   /auth/verify-email             (auth helpers)
//   /brokers, /brokers/[slug]      (public broker directory)
//   /about, /contact, /faq, /privacy, /terms  (marketing)
//   /subscription                  (public plan picker)
//   /guides, /blog, /calculator    (content)
//   /claim-broker                  (claim-broker public entry)
//
//   API PATHS (method-aware)
//   /api/auth/*                    (Auth.js handler — public by design)
//   /api/claims/*                  (public claim flow)
//   /api/brokers, /api/brokers/*  (public broker directory; EXCLUDES /me)
//   /api/brokers/me/*              (PROTECTED — must never be public)
//   /api/company/*                 (public company directory + register)
//   /api/cities, /api/states,
//   /api/location/*                (public reference data)
//   /api/contacts/send             (public contact form)
//   /api/ads/*                     (public advertisement tracking)
//   /api/stripe/webhook            (Stripe signature IS the auth)
//   /api/subscription/plans        (GET ONLY — public plan read)
//
//   STATIC EXCLUDES (handled by matcher, not here)
//   /_next/static, /_next/image, /favicon.ico, /public, /assets, /uploads
//
// Security risk: the broad '/api/company/*' and '/api/brokers/*' rules rely on
// individual route handlers to enforce role/membership checks. This is the
// project's existing architecture; tightening those to per-route proxy rules
// is a separate audit and intentionally out of scope here. Narrowing the
// /api/subscription/* surface is in scope for this phase.
// ---------------------------------------------------------------------------

// Public API endpoints that are method-aware (e.g. GET-only).
// Each entry: { method: 'GET' | 'POST' | 'ALL', pattern: RegExp }
const PUBLIC_METHOD_AWARE_API: Array<{ method: 'GET' | 'POST' | 'ALL'; pattern: RegExp }> = [
  // Public plan read — the broker subscription plan picker /signup must be
  // able to render plans for completely unauthenticated visitors. The route
  // handler returns a display-safe DTO (no Stripe secrets, no customer data).
  { method: 'GET', pattern: /^\/api\/subscription\/plans\/?$/ },
]

function isPublicMethodAwareApi(method: string, path: string): boolean {
  return PUBLIC_METHOD_AWARE_API.some(
    (entry) => (entry.method === 'ALL' || entry.method === method) && entry.pattern.test(path),
  )
}

// A company-scoped destination for the proxy's post-login / auth/signin routing.
// Deliberately prefix-based (no DB access in the edge runtime); the company
// pages themselves enforce the exact resume step server-side.
function isCompanyPathForProxy(path: string): boolean {
  return path.startsWith('/company/')
}

export default async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: AUTH_SECRET,
    secureCookie: secureSessionCookies(),
  })
  const path = request.nextUrl.pathname
  const method = request.method

  if (path === '/auth/signin' && token) {
    const callbackUrl = request.nextUrl.searchParams.get('callbackUrl')
    const origin = request.nextUrl.origin
    // Company users are membership-based (User.role stays USER); route them to
    // their company account hub so they can never fall to the generic home page
    // after login. The /company/dashboard page (and /company/onboarding) then
    // self-correct to the exact resume step. Broker/Admin use the role-based
    // postLoginRedirect; the broker dashboard further gates to /setup.
    if (token.isCompany) {
      // Email verification gate (Phase 8.37.1 F1): an email-registered company
      // user must verify before protected company functionality. Google company
      // users are verified-by-construction. Routing here (instead of the
      // company destination) also prevents the redirect loop that would
      // otherwise occur when a company page sends an unverified member to
      // /auth/signin.
      if (!token.emailVerified) {
        return NextResponse.redirect(new URL('/auth/verify-email', request.url))
      }
      const safePath = sanitizeCallbackUrl(callbackUrl, origin)
      const destination = safePath && isCompanyPathForProxy(safePath) ? safePath : '/company/dashboard'
      return NextResponse.redirect(new URL(destination, request.url))
    }
    return NextResponse.redirect(new URL(
      postLoginRedirect(token.role, callbackUrl, origin),
      request.url,
    ))
  }

  // ----- Public path matching (page-level + broad API prefixes) -----
  const publicPaths = [
    '/',
    '/auth/signin',
    '/auth/signup',
    '/register',
    '/company/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/error',
    '/auth/verify',
    '/auth/verify-email',
    '/brokers',
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
    '/robots.txt',
    '/sitemap.xml',
  ]

  const isExactPublicPath = publicPaths.includes(path)
  const isPublicPath = isExactPublicPath
    || path.startsWith('/api/auth')
    || path.startsWith('/api/claims')
    || path.startsWith('/uploads')
    || (path.startsWith('/brokers/') && !path.includes('/dashboard'))
    || (path === '/api/brokers')
    || (path.startsWith('/api/brokers/') && !path.includes('/me'))
    || path.startsWith('/api/company/')
    || path.startsWith('/api/location')
    || path.startsWith('/api/contacts/send')
    || path.startsWith('/api/ads')
    // Stripe webhook delivery is unauthenticated by design; the webhook route
    // verifies the Stripe signature itself (the signature IS the auth).
    || path.startsWith('/api/stripe/webhook')
    || path.startsWith('/about')
    || path.startsWith('/contact')
    || path.startsWith('/faq')
    || path.startsWith('/privacy')
    || path.startsWith('/terms')
    || path.startsWith('/subscription')
    || path.startsWith('/guides')
    || path.startsWith('/blog')
    || path.startsWith('/calculator')
    || path.startsWith('/claim-broker')
    // Method-aware public API endpoints (e.g. GET /api/subscription/plans).
    || isPublicMethodAwareApi(method, path)

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

  // Broker routes. The protected broker product area is /broker[/...]; the
  // /broker-registration/* continuation pages are NOT role-gated here because a
  // fresh Google signup still holds role USER until the broker-intent PUT on
  // the continue page creates the registration and flips the role to BROKER.
  // Gating those pages on BROKER would strand the Google broker flow in a
  // redirect loop to the role home. The broker-intent route (intent cookie +
  // legal-consent check + establishBrokerRegistration) remains the
  // authoritative gate for that boundary.
  if (path.startsWith('/broker') && !path.startsWith('/broker-registration')) {
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
