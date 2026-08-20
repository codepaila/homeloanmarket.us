import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { hasPaidEntitlement, BROKER_EDITABLE_FIELDS } from '../lib/broker-policy'
import { isClaimRecipientMatch } from '../lib/claim-policy'
import { isStaleEvent } from '../app/api/stripe/webhook/route'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

// =============================================================
// H4 — Invalid verification schema writes (already fixed)
// =============================================================

test('H4: no invalid verification writes remain anywhere in the codebase', () => {
  const files = ['app/api/brokers/[id]/route.ts', 'app/api/company/[slug]/route.ts', 'app/api/admin/brokers/[id]/route.ts']
  for (const file of files) {
    const source = read(file)
    assert.equal(source.includes("verificationStatus: 'PENDING'"), false, `${file} must not write PENDING`)
    assert.equal(source.includes('verificationDocuments'), false, `${file} must not write a non-schema verificationDocuments field`)
  }
  // Repo-wide scan
  const repoDirs = ['app', 'lib', 'actions']
  for (const dir of repoDirs) {
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []))
    for (const file of walk(dir)) {
      const src = fs.readFileSync(file, 'utf8')
      assert.equal(src.includes("'PENDING'"), false, `${file} must not reference a PENDING verification value`)
      assert.equal(src.includes('verificationDocuments'), false, `${file} must not reference verificationDocuments`)
    }
  }
})

test('H4: VerificationStatus enum supports only UNVERIFIED | VERIFIED', () => {
  const schema = read('prisma/schema.prisma')
  const m = schema.match(/enum VerificationStatus \{([^}]*)\}/)
  assert.ok(m, 'VerificationStatus enum must exist')
  const values = m[1].split(/\s+/).filter(Boolean)
  assert.deepEqual(values.sort(), ['UNVERIFIED', 'VERIFIED'])
})

test('H4: brokers cannot forge verification state (not in the editable allowlist)', () => {
  assert.equal((BROKER_EDITABLE_FIELDS as readonly string[]).includes('verificationStatus'), false)
  assert.equal((BROKER_EDITABLE_FIELDS as readonly string[]).includes('verifiedAt'), false)
})

test('H4: admin verification still works with the canonical enum', () => {
  const source = read('app/api/company/[slug]/route.ts')
  assert.ok(source.includes("updateData.verificationStatus === 'VERIFIED'"), 'admin verification uses the canonical VERIFIED value')
  assert.ok(source.includes('updateData.verifiedAt = new Date()'), 'verifiedAt derived server-side for admins')
})

// =============================================================
// H5 — FREE-tier service-city limit
// =============================================================

const freeSub = { plan: 'FREE' as const, isActive: true, endDate: null }
const featuredSub = { plan: 'FEATURED' as const, isActive: true, endDate: null }
const expiredFeatured = { plan: 'FEATURED' as const, isActive: true, endDate: new Date(Date.now() - 1000) }
const inactiveFeatured = { plan: 'FEATURED' as const, isActive: false, endDate: null }

test('H5: hasPaidEntitlement distinguishes paid from FREE/expired', () => {
  assert.equal(hasPaidEntitlement(freeSub), false, 'FREE plan is not paid even though isActive is true')
  assert.equal(hasPaidEntitlement(featuredSub), true, 'active FEATURED is paid')
  assert.equal(hasPaidEntitlement(expiredFeatured), false, 'expired FEATURED is not paid')
  assert.equal(hasPaidEntitlement(inactiveFeatured), false, 'inactive FEATURED is not paid')
})

// =============================================================
// H6 — Stripe webhook out-of-order race
// =============================================================

test('H6: newer event followed by older event is detected as stale (cannot regress)', () => {
  assert.equal(isStaleEvent(200, 100), true, 'older event after newer must be stale')
})

test('H6: older event followed by newer event is NOT stale (newer wins)', () => {
  assert.equal(isStaleEvent(100, 200), false, 'newer event must not be blocked by older')
  assert.equal(isStaleEvent(null, 200), false, 'first event is never stale')
  assert.equal(isStaleEvent(200, 200), false, 'equal timestamps are not stale')
})

test('H6: ordering guard considers in-flight PROCESSING events and registers before checking', () => {
  const source = read('app/api/stripe/webhook/route.ts')
  assert.ok(source.includes("status: { in: ['PROCESSED', 'PROCESSING'] }"), 'stale check must include in-flight PROCESSING events')
  const createIdx = source.indexOf('eventType: event.type,')
  const staleIdx = source.indexOf('await hasNewerAppliedEvent(')
  assert.ok(createIdx !== -1 && staleIdx !== -1, 'both the in-flight registration and the ordering check must exist')
  assert.ok(createIdx < staleIdx, 'the event must be registered as in-flight BEFORE the ordering check')
})

test('H6: per-subscription serialization lock exists with graceful fallback', () => {
  const source = read('app/api/stripe/webhook/route.ts')
  assert.ok(source.includes('withWebhookSubscriptionLock'), 'per-subscription lock must exist')
  assert.ok(source.includes('subscription:${subscriptionId}'), 'lock keyed by subscription id')
})

test('H6: Stripe signature verification and unique eventId idempotency are preserved', () => {
  const source = read('app/api/stripe/webhook/route.ts')
  assert.ok(source.includes('webhooks.constructEvent'), 'signature verification must remain')
  assert.ok(source.includes("error?.code === 'P2002'"), 'unique eventId duplicate handling must remain')
  assert.ok(source.includes("existing?.status === 'PROCESSED'"), 'PROCESSED idempotency must remain')
})

// =============================================================
// H7 — Claim invitation recipient binding
// =============================================================

test('H7: intended recipient matches (case-insensitive)', () => {
  assert.equal(isClaimRecipientMatch('Owner@Acme.com', 'owner@acme.com'), true)
  assert.equal(isClaimRecipientMatch('owner@acme.com', 'owner@acme.com'), true)
})

test('H7: a different authenticated user cannot match the intended recipient', () => {
  assert.equal(isClaimRecipientMatch('owner@acme.com', 'attacker@acme.com'), false)
  assert.equal(isClaimRecipientMatch('owner@acme.com', null), false)
  assert.equal(isClaimRecipientMatch(null, 'owner@acme.com'), false)
})

test('H7: completion and email steps enforce the recipient binding', () => {
  const completion = read('lib/claim-completion.ts')
  assert.ok(completion.includes('isClaimRecipientMatch('), 'completion must enforce recipient binding')
  assert.ok(completion.includes("new ClaimFlowError('INELIGIBLE')"), 'mismatch must be rejected as ineligible')

  const emailRoute = read('app/api/claims/session/email/route.ts')
  assert.ok(emailRoute.includes('isClaimRecipientMatch('), 'email step must enforce recipient binding')
})
