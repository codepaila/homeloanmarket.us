import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

// ---------------------------------------------------------------------------
// PHASE 3 — Cross-product Stripe Price isolation (Broker vs Company plans)
// ---------------------------------------------------------------------------
// Audit F4: `BrokerSubscriptionPlan.stripePriceId` is not @unique, so the same
// Stripe Price could be assigned to both a broker plan and a company plan.
// The fix is application-level validation at every admin write path (not a DB
// global constraint), because a MongoDB/Prisma global unique over a shared
// column could fail on existing duplicates and is not strictly necessary.
// ---------------------------------------------------------------------------

test('shared isolation module is not a DB constraint and exports a clear error', () => {
  const module = read('lib/plan-price-isolation.ts')
  assert.match(module, /assertStripePriceIsolation/)
  assert.match(module, /CROSS_PRODUCT_PRICE_ERROR/)
  assert.match(module, /This Stripe Price is already assigned to another subscription product\./)
  // It enforces cross-product checks (Broker plan when source is COMPANY and
  // vice versa), not a DB-level global unique index.
  assert.match(module, /brokerSubscriptionPlan\.findFirst/)
  assert.match(module, /companyAdvertisingPlan\.findFirst/)
})

test('company plan create validates price isolation (COMPANY source)', () => {
  const route = read('app/api/admin/company-advertising-plans/route.ts')
  assert.match(route, /assertStripePriceIsolation\(input\.stripePriceId, 'COMPANY'\)/)
  assert.match(route, /if \(!isolation\.ok\) return NextResponse\.json\(\{ error: isolation\.message \}, \{ status: 422 \}\)/)
})

test('company plan update validates price isolation and excludes the plan being edited', () => {
  const route = read('app/api/admin/company-advertising-plans/[id]/route.ts')
  assert.match(route, /assertStripePriceIsolation\(nextPriceId, 'COMPANY', id\)/)
  assert.match(route, /isolation\.ok/)
})

test('broker plan create validates price isolation (BROKER source)', () => {
  const route = read('app/api/admin/broker-plans/route.ts')
  assert.match(route, /assertStripePriceIsolation\(stripePriceId, 'BROKER'\)/)
  assert.match(route, /isolation\.ok/)
  assert.match(route, /isolation\.message/)
})

test('broker plan update validates price isolation and excludes the plan being edited', () => {
  const route = read('app/api/admin/broker-plans/[id]/route.ts')
  assert.match(route, /assertStripePriceIsolation\(resultingPriceId, 'BROKER', id\)/)
  assert.match(route, /isolation\.ok/)
})

test('no global StripePrice table was introduced', () => {
  // The chosen solution avoids adding a global table. Confirm the schema does
  // not declare one and that no file references a cross-product join table.
  const schema = read('prisma/schema.prisma')
  assert.doesNotMatch(schema, /model StripePrice\b/)
})

test('BrokerSubscriptionPlan.stripePriceId is intentionally not made globally unique', () => {
  // Each product keeps its own price column; isolation is enforced in code at
  // the four admin write paths, not by a shared DB uniqueness. This checks the
  // broker column is NOT @unique (only the company one is) — matching the
  // documented design.
  const schema = read('prisma/schema.prisma')
  const brokerBlock = schema.slice(schema.indexOf('model BrokerSubscriptionPlan'), schema.indexOf('model CompanyAdvertisingPlan'))
  assert.doesNotMatch(brokerBlock, /stripePriceId\s+String\?\s+@unique/)
})
