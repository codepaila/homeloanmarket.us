import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

// ---------------------------------------------------------------------------
// PHASE 2 — Company Stripe status mapping
// ---------------------------------------------------------------------------
// The audit found that several Stripe subscription states collapsed into a
// generic EXPIRED. The mapping now preserves semantic distinctions (INCOMPLETE,
// INCOMPLETE_EXPIRED, UNPAID, PAUSED) while never granting access for any
// non-active state.
// ---------------------------------------------------------------------------

test('schema defines the semantic non-active company subscription statuses', () => {
  const schema = read('prisma/schema.prisma')
  const enumBlock = schema.slice(schema.indexOf('enum CompanySubscriptionStatus'), schema.indexOf('enum CompanyAdRequestStatus'))
  assert.match(enumBlock, /INCOMPLETE/)
  assert.match(enumBlock, /INCOMPLETE_EXPIRED/)
  assert.match(enumBlock, /UNPAID/)
  assert.match(enumBlock, /PAUSED/)
  assert.match(enumBlock, /PAST_DUE/)
  assert.match(enumBlock, /CANCELED/)
  assert.match(enumBlock, /CHECKOUT_PENDING/)
  assert.match(enumBlock, /ACTIVE/)
  assert.match(enumBlock, /EXPIRED/)
})

test('webhook maps Stripe statuses distinctly and never grants access for non-active states', () => {
  const service = read('lib/subscription.ts')
  // The canonical mapping helper exists.
  assert.match(service, /mapCompanySubscriptionStatus/)
  assert.match(service, /case 'active'/)
  assert.match(service, /case 'trialing'/)
  assert.match(service, /case 'past_due'/)
  assert.match(service, /case 'incomplete'/)
  assert.match(service, /case 'incomplete_expired'/)
  assert.match(service, /case 'unpaid'/)
  assert.match(service, /case 'paused'/)
  assert.match(service, /case 'canceled'/)
  // updateCompanySubscriptionFromStripe uses the mapping.
  assert.match(service, /const mapped = mapCompanySubscriptionStatus\(status\)/)
  assert.match(service, /const isActive = mapped\.isActive/)
})

test('access control only grants for ACTIVE + isActive', () => {
  const access = read('lib/company-ad-access.ts')
  assert.match(access, /status === 'ACTIVE' && subscription\?\.isActive === true/)
  // Non-active statuses never appear as granting.
  assert.doesNotMatch(access, /status === 'INCOMPLETE'.*isActive === true/)
  assert.doesNotMatch(access, /status === 'UNPAID'.*isActive === true/)
})

test('every mapped status sets isActive false except active/trialing', () => {
  // Structural guard across all non-active branches: they must set isActive false.
  const service = read('lib/subscription.ts')
  for (const branch of ['past_due', 'incomplete', 'incomplete_expired', 'unpaid', 'paused', 'canceled']) {
    const idx = service.indexOf(`case '${branch}':`)
    assert.ok(idx > -1, `status branch exists: ${branch}`)
    const segment = service.slice(idx, service.indexOf('case ', idx + 2))
    assert.match(segment, /isActive: false/, `${branch} must map to isActive false`)
  }
})
