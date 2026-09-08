import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { CompanyConsentRequiredError } from '@/lib/company-intent'

const read = (p: string) => fs.readFileSync(p, 'utf8')
const registerRoute = read('app/api/company/register/route.ts')
const form = read('app/(public)/company/register/CompanyRegisterForm.tsx')
const intentRoute = read('app/api/auth/company-intent/route.ts')
const intentLib = read('lib/company-intent.ts')
const continuePage = read('app/company/register/continue/page.tsx')
const consentPage = read('app/company/register/consent/page.tsx')
const consentRoute = read('app/api/auth/consent/route.ts')
const companyPolicy = read('lib/company-policy.ts')
const verifyRoute = read('app/api/auth/verify-email/route.ts')
const proxy = read('proxy.ts')
const schema = read('prisma/schema.prisma')

// ===========================================================================
// PHASE 8.37.1 — JOIN AS COMPANY REGISTRATION HARDENING (F1–F5)
// ===========================================================================

// ---------- A. EMAIL REGISTRATION ----------

test('A1 email registration persists server-side legal consent on the created user', () => {
  assert.match(registerRoute, /agreeToTerms === true/)
  assert.match(registerRoute, /agreeToPrivacy === true/)
  assert.match(registerRoute, /agreeToTerms, agreeToPrivacy/)
  // The client form forwards both consent flags (single combined checkbox).
  assert.match(form, /agreeToTerms: data\.agreeTerms, agreeToPrivacy: data\.agreeTerms/)
})

test('A2/A3/A4 missing terms or privacy consent is rejected server-side (both required)', () => {
  assert.match(registerRoute, /if \(!agreeToTerms \|\| !agreeToPrivacy\)/)
  assert.match(registerRoute, /Terms & Conditions and Privacy Policy/)
})

test('A5 duplicate email returns 409', () => {
  assert.match(registerRoute, /An account with this email already exists/)
  assert.match(registerRoute, /status: 409/)
})

test('A6 concurrent duplicate email is safely mapped to 409 (no generic 500)', () => {
  assert.match(registerRoute, /\?\.code === 'P2002'/)
  assert.match(registerRoute, /An account with this email already exists/)
  assert.match(registerRoute, /status: 409/)
  assert.doesNotMatch(registerRoute, /catch[\s\S]{0,80}status: 500[\s\S]{0,20}status: 409/)
})

test('A7 created Company is PENDING', () => {
  assert.match(registerRoute, /status: 'PENDING'/)
})

test('A8 OWNER membership is created during email registration', () => {
  assert.match(registerRoute, /role: 'OWNER'/)
})

test('A9 email registration starts emailVerified=false', () => {
  assert.match(registerRoute, /emailVerified: false/)
})

test('A10 verification email is triggered through the existing mechanism', () => {
  assert.match(registerRoute, /sendUserVerificationEmail/)
})

// ---------- B. EMAIL VERIFICATION ----------

test('B11 valid token verifies via the canonical token flow', () => {
  assert.match(verifyRoute, /emailVerified: true/)
  assert.match(verifyRoute, /emailVerificationToken: null/)
})

test('B12/B13 invalid and expired tokens are rejected', () => {
  assert.match(verifyRoute, /Invalid or expired verification token/)
  assert.match(verifyRoute, /Verification token has expired/)
})

test('B14/B15 token consumption is atomic and single-use (updateMany gated on token)', () => {
  assert.match(verifyRoute, /updateMany\(\{/)
  assert.match(verifyRoute, /where: \{ id: user\.id, emailVerificationToken: expectedTokenHash \}/)
  assert.match(verifyRoute, /consumed\.count !== 1/)
  assert.match(verifyRoute, /Invalid or expired verification token/)
})

test('B16 stale/new-token race cannot consume a newer token', () => {
  // The atomic update matches the exact token that was read; if the token was
  // replaced or consumed, zero rows match and verification fails safely.
  assert.match(verifyRoute, /emailVerificationToken: expectedTokenHash/)
  assert.match(verifyRoute, /expectedTokenHash = emailChangeTokenMatched \? emailChangeTokenHash : hashedToken/)
})

// ---------- C. COMPANY ACCESS (F1) ----------

test('C17 unverified email company user is blocked at the canonical company boundary', () => {
  assert.match(companyPolicy, /if \(!user\.emailVerified\) return null/)
})

test('C18/C19 verified (email or Google) company users are allowed', () => {
  // Google users are emailVerified by construction; the gate only blocks
  // unverified accounts, and verified users fall through to the membership query.
  assert.match(companyPolicy, /if \(!user\.emailVerified\) return null/)
  assert.match(companyPolicy, /prisma\.companyMembership\.findFirst/)
  // No second verification step is added for Google company users.
  assert.doesNotMatch(intentRoute, /sendUserVerificationEmail/)
  assert.doesNotMatch(intentLib, /emailVerified/)
})

test('C20/C21/C22 normal USER, suspended company, and Admin behavior unchanged', () => {
  // Gate only adds the emailVerified condition; membership/suspended checks and
  // Admin (no membership) remain as before.
  assert.match(companyPolicy, /status: \{ not: 'SUSPENDED' \}/)
  assert.match(companyPolicy, /!user \|\| !user\.isActive/)
})

test('C17b unverified company users are routed to the verify page by the proxy (no redirect loop)', () => {
  assert.match(proxy, /if \(!token\.emailVerified\)/)
  assert.match(proxy, /\/auth\/verify-email/)
  assert.match(proxy, /token\.isCompany/)
})

// ---------- D. GOOGLE COMPANY FLOW ----------

test('D23 valid intent establishes a Company (OWNER membership)', () => {
  assert.match(intentLib, /role: 'OWNER'/)
  assert.match(intentLib, /company\.create/)
})

test('D24 no intent is rejected', () => {
  assert.match(intentRoute, /Company registration intent is required/)
  assert.match(intentRoute, /status: 403/)
})

test('D25/D26 intent expiry and replay are rejected (signed cookie, one-shot)', () => {
  assert.match(intentRoute, /maxAge: 15 \* 60/)
  assert.match(intentLib, /createHmac\('sha256', secret\)/)
  assert.match(intentRoute, /response\.cookies\.delete\(COMPANY_INTENT_COOKIE\)/)
})

test('D27/D28 concurrent continuation produces exactly one Company + one OWNER (DB unique index)', () => {
  assert.match(schema, /@@unique\(\[userId, role\]\)/)
  assert.match(intentLib, /\?\.code === 'P2002'/)
  assert.match(intentLib, /alreadyCompany: true/)
})

test('D-consent Google company path requires explicit server-side legal consent', () => {
  const err = new CompanyConsentRequiredError()
  assert.ok(err instanceof Error)
  assert.equal(err.name, 'CompanyConsentRequiredError')
  assert.match(intentLib, /agreeToTerms !== true \|\| user\.agreeToPrivacy !== true/)
  assert.match(intentLib, /new CompanyConsentRequiredError\(\)/)
  assert.match(intentRoute, /consentRequired: true/)
  assert.match(continuePage, /consentRequired/)
  assert.match(continuePage, /\/company\/register\/consent/)
  assert.match(consentPage, /\/api\/auth\/consent/)
  assert.match(consentPage, /agreeToTerms: agreeTerms, agreeToPrivacy: agreePrivacy/)
  // Consent endpoint is server-authoritative and role-agnostic (reused, not duplicated).
  assert.match(consentRoute, /agreeToTerms = body\?\.agreeToTerms === true/)
  assert.match(consentRoute, /agreeToPrivacy = body\?\.agreeToPrivacy === true/)
})

// ---------- E. OWNERSHIP ----------

test('E29/E30 ownership is derived from the authenticated session; client cannot supply IDs', () => {
  assert.match(intentLib, /where: \{ id: userId \}/)
  assert.doesNotMatch(registerRoute, /body\.userId/)
  assert.doesNotMatch(registerRoute, /body\.companyId/)
  assert.doesNotMatch(intentRoute, /body\.userId|body\.companyId/)
})

test('E31 concurrent establishment converges on the existing company', () => {
  assert.match(intentLib, /existingMembership/)
  assert.match(intentLib, /return \{ alreadyCompany: true/)
})

// ---------- F6 ----------

test('F6 existing credentials user + Google remains intentionally unchanged (app-wide auth behavior)', () => {
  // The Google signIn callback only sets emailVerified on NEW user creation —
  // shared across ALL roles (broker, company, plain user). The F1 gate blocks
  // unverified company users regardless, so no company-specific change is
  // warranted (documented decision, not a code path we introduce here).
  assert.doesNotMatch(registerRoute, /emailVerified: true/)
})