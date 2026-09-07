import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { sanitizeCallbackUrl, postLoginRedirect, roleHome } from '../lib/auth-redirect'
import { resolveUserResumePath } from '../lib/user-resume'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ===========================================================================
// 8.27 — AUTHENTICATION / REGISTRATION ARCHITECTURE AUDIT
//
// Verifies the existing single authentication architecture end-to-end (source
// level + pure-function level): identity uniqueness, role assignment, Google
// signup, canonical resume, callback safety, broker gating, session refresh,
// email verification and rate limiting. Intentionally does NOT introduce a
// second auth stack; assertions pin existing behavior so regressions surface.
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. UNIQUE EMAIL / IDENTITY
// ---------------------------------------------------------------------------

test('EMAIL: every registration entry lowercases and normalizes email before lookup', () => {
  const user = read('app/api/auth/register/user/route.ts')
  const broker = read('app/api/auth/register/broker/route.ts')
  const company = read('app/api/company/register/route.ts')
  const signin = read('app/(public)/auth/signin/page.tsx')
  assert.match(user, /trim\(\)\.toLowerCase\(\)/)
  assert.match(company, /trim\(\)\.toLowerCase\(\)/)
  assert.match(broker, /normalizeBrokerAccountRegistrationInput/)
  assert.match(signin, /type="email"/)
})

test('EMAIL: duplicate email is rejected at every account-registration boundary (no second account)', () => {
  const user = read('app/api/auth/register/user/route.ts')
  const company = read('app/api/company/register/route.ts')
  const broker = read('app/api/auth/register/broker/route.ts')
  assert.match(user, /findFirst\(\{ where: \{ email/)
  assert.match(user, /status: 409/)
  assert.match(company, /findUnique\(\{ where: \{ email/)
  assert.match(company, /status: 409/)
  assert.match(broker, /DuplicateAccountError/)
  assert.match(broker, /status: 409/)
})

test('EMAIL: passwords are stored hashed only, never plaintext at any register boundary', () => {
  const user = read('app/api/auth/register/user/route.ts')
  const company = read('app/api/company/register/route.ts')
  const auth = read('lib/auth.config.ts')
  assert.match(user, /hashPassword\(password\)/)
  assert.match(company, /hashPassword\(password\)/)
  assert.doesNotMatch(user, /password:\s*password\b|data:\s*\{\s*password\s*,/)
  assert.match(auth, /bcrypt\.compare\(password, user\.password\)/)
})

test('EMAIL: registration attempts are rate limited per IP', () => {
  const user = read('app/api/auth/register/user/route.ts')
  const broker = read('app/api/auth/register/broker/route.ts')
  const company = read('app/api/company/register/route.ts')
  assert.match(user, /customerRegisterRateLimit/)
  assert.match(broker, /brokerRegisterRateLimit/)
  assert.match(company, /customerRegisterRateLimit/)
  assert.match(user, /status: 429/)
  assert.match(broker, /status: 429/)
  assert.match(company, /status: 429/)
})

// ---------------------------------------------------------------------------
// 2. ROLE ASSIGNMENT ON GOOGLE SIGNUP (NEW USER)
// ---------------------------------------------------------------------------

test('GOOGLE: new-user signup creates role USER, isActive, emailVerified (Google-verified email)', () => {
  const auth = read('lib/auth.config.ts')
  assert.match(auth, /profile\(profile\) \{/)
  assert.match(auth, /role: "USER"/)
  const signIn = read('lib/auth.config.ts')
  assert.match(signIn, /role: "USER", \/\/ Default role/)
  assert.match(signIn, /isActive: true,/)
  assert.match(signIn, /emailVerified: true,/)
})

test('GOOGLE: signup links the OAuth account and never auto-promotes to BROKER/COMPANY', () => {
  const auth = read('lib/auth.config.ts')
  assert.match(auth, /prisma\.account\s*\.create\(/)
  assert.match(auth, /providerAccountId/)
  assert.match(auth, /P2002/)
  assert.doesNotMatch(auth, /role: ["']BROKER["']\s*,\s*\n?\s*isActive: true/)
  // The signIn callback must NOT contain auto-account linking flags; matching a
  // Google email against an existing credentials-only account is NOT silently
  // merged — the default OAuthAccountNotLinked behavior stays in place.
  assert.doesNotMatch(auth, /allowDangerousEmailAccountLinking/)
})

test('GOOGLE: provider image never leaks onto the broker profile (section: image copy)', () => {
  const auth = read('lib/auth.config.ts')
  assert.match(auth, /image: profile\.picture/)
  // No Google picture write to Broker.profileImage anywhere in the auth path.
  assert.doesNotMatch(read('lib/auth.config.ts'), /profileImage.*picture|picture.*profileImage/)
})

// ---------------------------------------------------------------------------
// 3. CANONICAL SECRET
// ---------------------------------------------------------------------------

test('SECRET: a single canonical AUTH_SECRET is used by Auth.js, proxy and intent cookies', () => {
  const auth = read('lib/auth.config.ts')
  const proxy = read('proxy.ts')
  const brokerIntent = read('lib/broker-intent.ts')
  const companyIntent = read('lib/company-intent.ts')
  assert.match(auth, /secret: process\.env\.AUTH_SECRET/)
  assert.match(proxy, /process\.env\.AUTH_SECRET/)
  assert.match(brokerIntent, /process\.env\.AUTH_SECRET/)
  assert.match(companyIntent, /process\.env\.AUTH_SECRET/)
  // No TOKEN secret alternative is consulted for signing cookies.
  assert.doesNotMatch(auth, /secret: process\.env\.(JWT_SECRET|NEXTAUTH_SECRET)/)
})

test('SECRET: intent cookies are HMAC-signed with distinct registration domains', () => {
  const brokerIntent = read('lib/broker-intent.ts')
  const companyIntent = read('lib/company-intent.ts')
  assert.match(brokerIntent, /createHmac\('sha256', secret\)\.update\('broker-registration-intent'\)/)
  assert.match(companyIntent, /createHmac\('sha256', secret\)\.update\('company-registration-intent'\)/)
  assert.match(brokerIntent, /BROKER_INTENT_COOKIE = 'homeloanmarket_broker_intent'/)
  assert.match(companyIntent, /COMPANY_INTENT_COOKIE = 'homeloanmarket_company_intent'/)
})

// ---------------------------------------------------------------------------
// 4. SESSION / JWT REFRESH (server-authoritative identity)
// ---------------------------------------------------------------------------

test('SESSION: JWT strategy, 30-day maxAge, identity NEVER taken from client update', () => {
  const auth = read('lib/auth.config.ts')
  assert.match(auth, /strategy: "jwt"/)
  assert.match(auth, /maxAge: 30 \* 24 \* 60 \* 60/)
  assert.match(auth, /dbUser = await prisma\.user\.findUnique/)
  assert.match(auth, /token\.email = dbUser\.email/)
  assert.match(auth, /token\.role = dbUser\.role/)
  assert.match(auth, /dbUser\.isActive/)
  // A deleted account clears the token entirely (server-side session kill).
  assert.match(auth, /return \{\} as any;/)
})

test('SESSION: isCompany derived only from active memberships (no COMPANY role)', () => {
  const auth = read('lib/auth.config.ts')
  const schema = read('prisma/schema.prisma')
  const userRoleEnum = schema.match(/enum UserRole \{([\s\S]*?)\}/)?.[1] ?? ''
  assert.doesNotMatch(userRoleEnum, /COMPANY/)
  assert.match(auth, /token\.isCompany = Boolean\(dbUser\.companyMemberships\?\.length\)/)
  assert.match(auth, /companyMemberships: \{\s*where: \{ isActive: true \}/)
})

// ---------------------------------------------------------------------------
// 5. BROKER GATING (robot / role checks)
// ---------------------------------------------------------------------------

test('BROKER-GATE: role-gated dashboard requires BROKER and rejects others via proxy', () => {
  const proxy = read('proxy.ts')
  assert.match(proxy, /path\.startsWith\('\/broker'\) && !path\.startsWith\('\/broker-registration'\)/)
  assert.match(proxy, /userRole !== 'BROKER'/)
  assert.match(proxy, /roleHome\(userRole\)/)
})

test('BROKER-GATE: broker-registration continuation pages are NOT (broker) role-gated in the proxy so a USER can reach them', () => {
  // A new Google signup holds role USER until the continue page PUT flows the
  // registration in and flips the role to BROKER; gating those pages behind the
  // BROKER role would strand the Google flow in a redirect loop to "/".
  const proxy = read('proxy.ts')
  assert.match(proxy, /\/broker-registration/)
  const gate = proxy.match(/if \(path\.startsWith\('\/broker'\)([\s\S]*?)\) \{/)?.[1] ?? ''
  assert.match(gate, /!path\.startsWith\('\/broker-registration'\)/)
  const isBrokerReg = (path: string) => path.startsWith('/broker') && !path.startsWith('/broker-registration')
  assert.equal(isBrokerReg('/broker-registration/continue'), false)
  assert.equal(isBrokerReg('/broker-registration/consent'), false)
  assert.equal(isBrokerReg('/broker/dashboard'), true)
  assert.equal(isBrokerReg('/broker'), true)
})

test('BROKER-GATE: /broker-registration/continue and /consent POST/PUT boundaries enforce consent + intent', () => {
  const intent = read('app/api/auth/broker-intent/route.ts')
  assert.match(intent, /hasBrokerRegistrationIntent\(\)/)
  assert.match(intent, /agreeToTerms !== true/)
  assert.match(intent, /consentRequired: true/)
  assert.match(intent, /establishBrokerRegistration\(user\.id\)/)
  assert.match(intent, /response\.cookies\.delete\(BROKER_INTENT_COOKIE\)/)
  const consent = read('app/(public)/broker-registration/consent/page.tsx')
  assert.match(consent, /agreeToTerms/)
})

test('BROKER-GATE: dashboard server page gates to roleHome and state machine, never renders incomplete brokers', () => {
  const page = read('app/broker/dashboard/page.tsx')
  const state = read('lib/broker-onboarding-state.ts')
  assert.match(page, /user\.role !== 'BROKER'/)
  assert.match(page, /roleHome\(user\.role\)/)
  assert.match(page, /resolveBrokerOnboardingDestination\(user, '\/broker\/dashboard'\)/)
  assert.match(state, /isBrokerSetupComplete/)
})

// ---------------------------------------------------------------------------
// 6. CALLBACK URL SAFETY
// ---------------------------------------------------------------------------

test('CALLBACK: sanitizeCallbackUrl rejects foreign origins, protocol-relative, backslash and control chars', () => {
  assert.equal(sanitizeCallbackUrl('//evil.example/steal', 'https://app.example'), null)
  assert.equal(sanitizeCallbackUrl('https://evil.example/steal', 'https://app.example'), null)
  assert.equal(sanitizeCallbackUrl('/a\\b', 'https://app.example'), null)
  assert.equal(sanitizeCallbackUrl('/path\u0000x', 'https://app.example'), null)
  assert.equal(sanitizeCallbackUrl('', 'https://app.example'), null)
  assert.equal(sanitizeCallbackUrl(null, 'https://app.example'), null)
  assert.equal(sanitizeCallbackUrl('/auth/signin', 'https://app.example'), null)
  assert.equal(sanitizeCallbackUrl('/auth/error', 'https://app.example'), null)
})

test('CALLBACK: same-origin path+search+hash is preserved, loop targets blocked', () => {
  assert.equal(sanitizeCallbackUrl('/broker-registration/continue?plan=FEATURED', 'https://app.example'), '/broker-registration/continue?plan=FEATURED')
  assert.equal(sanitizeCallbackUrl('/company/onboarding', 'https://app.example'), '/company/onboarding')
  assert.equal(sanitizeCallbackUrl('/setup', 'https://app.example'), '/setup')
  assert.equal(sanitizeCallbackUrl('/dashboard', 'https://app.example'), '/dashboard')
})

test('CALLBACK: postLoginRedirect never lets a USER land on broker/admin product URLs', () => {
  assert.equal(postLoginRedirect('USER', '/broker/dashboard', 'https://app.example'), roleHome('USER'))
  assert.equal(postLoginRedirect('USER', '/broker', 'https://app.example'), roleHome('USER'))
  assert.equal(postLoginRedirect('USER', '/admin', 'https://app.example'), roleHome('USER'))
  assert.equal(postLoginRedirect('USER', '/dashboard', 'https://app.example'), roleHome('USER'))
})

test('CALLBACK: registration continuation paths remain reachable for the (USER-role) Google flow', () => {
  assert.equal(postLoginRedirect('USER', '/broker-registration/continue', 'https://app.example'), '/broker-registration/continue')
  assert.equal(postLoginRedirect('USER', '/broker-registration/consent', 'https://app.example'), '/broker-registration/consent')
  assert.equal(postLoginRedirect('USER', '/company/register/continue', 'https://app.example'), '/company/register/continue')
  assert.equal(postLoginRedirect('BROKER', '/broker/dashboard', 'https://app.example'), '/broker/dashboard')
})

test('CALLBACK: proxy /auth/signin pin redirects authenticated users by product state', () => {
  const proxy = read('proxy.ts')
  assert.match(proxy, /path === '\/auth\/signin' && token/)
  assert.match(proxy, /postLoginRedirect\(token\.role, callbackUrl, origin\)/)
  assert.match(proxy, /token\.isCompany/)
  assert.match(proxy, /isCompanyPathForProxy/)
  assert.match(proxy, /'\/company\/dashboard'/)
})

// ---------------------------------------------------------------------------
// 7. EMAIL VERIFICATION
// ---------------------------------------------------------------------------

test('VERIFY: token hashing, expiry, plan whitelist and product-aware redirect target', () => {
  const verify = read('app/api/auth/verify-email/route.ts')
  assert.match(verify, /createHash\('sha256'\)/)
  assert.match(verify, /emailVerificationTokenExpiresAt <= new Date\(\)/)
  assert.match(verify, /VALID_PLAN_CODES = \['FREE', 'FEATURED'\]/)
  assert.match(verify, /sanitizePlan\(rawPlan\)/)
  assert.match(verify, /updatedUser\.brokerRegistration\?\.id \? '\/setup'/)
  assert.match(verify, /updatedUser\.companyMemberships\?\.length \? '\/company\/onboarding'/)
  assert.match(verify, /'\/claim-broker\/continue'/)
  assert.match(verify, /signIn\('credentials'/)
  assert.match(verify, /verificationToken: token/)
})

test('VERIFY: broker sign-in is gated on emailVerified unless a fresh verificationToken is exchanged', () => {
  const auth = read('lib/auth.config.ts')
  assert.match(auth, /user\.role === 'BROKER' && !user\.emailVerified && !verificationToken/)
  assert.match(auth, /updateMany\(\{/)
  // Consuming the token is atomic (updateMany guarded by the hashed token match).
  assert.match(auth, /emailVerificationToken: null, emailVerificationTokenExpiresAt: null/)
})

// ---------------------------------------------------------------------------
// 8. RESUME (product-aware, DB-authoritative)
// ---------------------------------------------------------------------------

test('RESUME: Google/email/company states converge to the same canonical resume path', () => {
  type CompanyFixture = {
    status: string
    onboardedAt: Date | null
    subscription: { status: string; isActive: boolean } | null
  }
  const companyUser = (company: CompanyFixture) => ({
    role: 'USER',
    brokerProfile: null,
    brokerRegistration: null,
    companyMemberships: [{ isActive: true, company }],
  })
  // PENDING shell (just created by Google intent or email register) -> onboarding.
  assert.equal(resolveUserResumePath(companyUser({ status: 'PENDING', onboardedAt: null, subscription: null })), '/company/onboarding')
  // CHECKOUT_PENDING -> plan select.
  assert.equal(resolveUserResumePath(companyUser({ status: 'ACTIVE', onboardedAt: new Date(), subscription: { status: 'CHECKOUT_PENDING', isActive: false } })), '/company/subscription/select')
  // Active advertiser -> dashboard.
  assert.equal(resolveUserResumePath(companyUser({ status: 'ACTIVE', onboardedAt: new Date(), subscription: { status: 'ACTIVE', isActive: true } })), '/company/dashboard')
  // A callback to a company path is preserved only for a company user.
  assert.equal(resolveUserResumePath(companyUser({ status: 'ACTIVE', onboardedAt: new Date(), subscription: { status: 'ACTIVE', isActive: true } }), '/company/onboarding'), '/company/onboarding')
})

test('RESUME: a normal USER is never sent to broker/company/admin/dashboard destinations', () => {
  const normal = { role: 'USER', brokerProfile: null, brokerRegistration: null, companyMemberships: [] }
  assert.equal(resolveUserResumePath(normal, '/broker/dashboard'), '/')
  assert.equal(resolveUserResumePath(normal, '/setup'), '/')
  assert.equal(resolveUserResumePath(normal, '/admin'), '/')
  assert.equal(resolveUserResumePath(normal, '/dashboard'), '/')
  assert.equal(resolveUserResumePath(normal, '/calculator'), '/calculator')
})

test('RESUME: stale BROKER role without registration/profile is treated as a normal user', () => {
  const stale = { role: 'BROKER', brokerProfile: null, brokerRegistration: null, companyMemberships: [] }
  assert.equal(resolveUserResumePath(stale, '/calculator'), '/calculator')
  assert.equal(resolveUserResumePath(stale), '/')
})

// ---------------------------------------------------------------------------
// 9. LOGIN BOUNDARY (fail-closed, generic errors, per-IP brute force guard)
// ---------------------------------------------------------------------------

test('LOGIN: credentials authorize + login action are rate-limited and never leak account existence', () => {
  const auth = read('lib/auth.config.ts')
  const action = read('actions/auth.action.ts')
  assert.match(auth, /brokerLoginRateLimit/)
  assert.match(action, /loginRateLimit\.limit/)
  assert.match(action, /Invalid credentials!/)
  // Provisional, generic wording at every failure.
  assert.doesNotMatch(auth + action, /Account with this email does not exist/i)
})

test('LOGIN: email comparison is case-insensitive at the shared credentials boundary', () => {
  const auth = read('lib/auth.config.ts')
  assert.match(auth, /trim\(\)\.toLowerCase\(\)/)
})

// ---------------------------------------------------------------------------
// 10. CLIENT CONTINUE PAGES (both Google continuations)
// ---------------------------------------------------------------------------

test('CONTINUE: broker and company continue pages fetch the intent PUT and follow server redirect', () => {
  const broker = read('app/broker-registration/continue/page.tsx')
  const company = read('app/company/register/continue/page.tsx')
  assert.match(broker, /\/api\/auth\/broker-intent/)
  assert.match(broker, /\{ method: 'PUT' \}/)
  assert.match(broker, /refreshSession\(\)/)
  assert.match(company, /\/api\/auth\/company-intent/)
  assert.match(company, /\{ method: 'PUT' \}/)
  assert.match(company, /refreshSession\(\)/)
})

test('CONTINUE: GoogleContinueButton carries intent for broker/company and plain callback otherwise', () => {
  const button = read('components/auth/GoogleContinueButton.tsx')
  const register = read('app/(public)/register/page.tsx')
  const companyForm = read('app/(public)/company/register/CompanyRegisterForm.tsx')
  assert.match(button, /\/api\/auth\/broker-intent/)
  assert.match(button, /\/api\/auth\/company-intent/)
  assert.match(register, /brokerIntent/)
  assert.match(companyForm, /companyIntent/)
  assert.match(button, /signIn\('google'/)
})