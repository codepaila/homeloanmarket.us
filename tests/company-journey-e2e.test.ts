import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const intentLib = read('lib/company-intent.ts')
const intentRoute = read('app/api/auth/company-intent/route.ts')
const registerRoute = read('app/api/company/register/route.ts')
const continuePage = read('app/company/register/continue/page.tsx')
const registerForm = read('app/(public)/company/register/CompanyRegisterForm.tsx')
const googleBtn = read('components/auth/GoogleContinueButton.tsx')
const verifyEmailRoute = read('app/api/auth/verify-email/route.ts')
const schema = read('prisma/schema.prisma')
const checkout = read('app/api/company/subscription/checkout/route.ts')
const authConfig = read('lib/auth.config.ts')

// ---------------------------------------------------------------------------
// Phase 8.14: entry-point parity — Google and email both reach the same
// canonical company flow (plan selection) and create exactly one company+OWNER.
// ---------------------------------------------------------------------------

test('both google and email entries land on the same canonical register flow', () => {
  assert.match(registerForm, /\/api\/company\/register/)
  assert.match(registerForm, /GoogleContinueButton[\s\S]{0,80}companyIntent/)
  assert.match(registerForm, /callbackUrl={?["']\/company\/register\/continue["']}|callbackUrl="\/company\/register\/continue"/)
  assert.match(googleBtn, /\/api\/auth\/company-intent/)
  // The google button's callbackUrl prop is supplied by callers; the intent
  // route defines the canonical state-based continue destination. A brand-new
  // company continues to onboarding (profile must precede advertising billing).
  assert.match(intentRoute, /resolveCompanyOnboardingDestination/)
  assert.match(intentRoute, /redirectTo/)
})

test('email and google both create a company shell + OWNER exactly once', () => {
  // Email path: transaction creates user + company + OWNER atomically.
  assert.match(registerRoute, /\$transaction/)
  assert.match(registerRoute, /role: 'OWNER'/)
  // Google path: establishCompanyForUser idempotently creates company + OWNER.
  assert.match(intentLib, /\$transaction/)
  assert.match(intentLib, /role: 'OWNER'/)
})

test('duplicate OWNER per company is blocked by a unique constraint and a find', () => {
  assert.match(schema, /model CompanyMembership/)
  assert.match(schema, /@@unique\(\[companyId, userId\]\)/)
  // Google path pre-checks an active membership before creating a company so a
  // replay never creates a second company (returns alreadyCompany).
  assert.match(intentLib, /companyMembership\.findFirst/)
  assert.match(intentLib, /\{ alreadyCompany: true\s*as const, companyId: existingMembership\.companyId \}/)
  // Email path: duplicate emails are rejected before the transaction.
  assert.match(registerRoute, /existing\) return NextResponse\.json\(\{ error: 'An account with this email already exists\. Please sign in\.' \}, \{ status: 409 \}\)/)
})

test('company membership and subscription singleton constraints exist (no cross-account bleed)', () => {
  assert.match(schema, /@@unique\(\[companyId, userId\]\)/)
  assert.match(schema, /companyId\s+String\s+@unique/)
})

// ---------------------------------------------------------------------------
// Phase 8.14: intent cookie — Google path preserves intent across OAuth.
// ---------------------------------------------------------------------------

test('company intent cookie is set before OAuth and verified on PUT', () => {
  // GoogleContinueButton sets the intent via POST before signing in with Google.
  assert.match(googleBtn, /\/api\/auth\/company-intent[\s\S]*?signIn\('google'/)
  // POST sets an HMAC cookie with a short TTL; PUT verifies it.
  assert.match(intentRoute, /POST/)
  assert.match(intentRoute, /maxAge: 15 \* 60/)
  assert.match(intentRoute, /response\.cookies\.set/)
  assert.match(intentRoute, /PUT/)
  assert.match(intentRoute, /hasCompanyRegistrationIntent/)
})

test('intent value is an HMAC signature, not a plain token', () => {
  assert.match(intentLib, /createHmac\('sha256', secret\)/)
  assert.match(intentLib, /COMPANY_INTENT_COOKIE/)
  assert.doesNotMatch(intentLib, /crypto\.randomBytes|Math\.random/)
})
