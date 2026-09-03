import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const seedFile = read('prisma/seed/index.ts')
const companyDefs = read('lib/company-plan-definitions.ts')
const brokerPlans = read('lib/broker-plans.ts')

// ============================================================================
// SEED: Broker Plans (FREE, FEATURED)
// ============================================================================

test('seed: creates FREE plan', () => {
  assert.match(seedFile, /seedSubscriptionPlans/)
  assert.match(seedFile, /DEFAULT_BROKER_PLANS/)
  assert.match(seedFile, /brokerSubscriptionPlan\.create/)
})

test('seed: creates FEATURED plan with $15 price', () => {
  const free = brokerPlans.match(/code:\s*'FREE'[\s\S]*?price:\s*(\d+)/)
  const featured = brokerPlans.match(/code:\s*'FEATURED'[\s\S]*?price:\s*(\d+)/)
  assert.ok(free)
  assert.ok(featured)
  assert.equal(free[1], '0')
  assert.equal(featured[1], '1500')
})

test('seed: FREE has 6 display features', () => {
  const freeFeatures = brokerPlans.match(/FREE:\s*\[([\s\S]*?)\]/)
  assert.ok(freeFeatures)
  const count = (freeFeatures[1].match(/label:/g) || []).length
  assert.equal(count, 6)
})

test('seed: FEATURED has 7 display features', () => {
  const featuredFeatures = brokerPlans.match(/FEATURED:\s*\[([\s\S]*?)\]/)
  assert.ok(featuredFeatures)
  const count = (featuredFeatures[1].match(/label:/g) || []).length
  assert.equal(count, 7)
})

test('seed: FEATURED displays as Mortgage Expert (internal code FEATURED)', () => {
  const featured = brokerPlans.match(/code:\s*'FEATURED',\s*name:\s*'([^']+)'/)
  assert.ok(featured)
  assert.equal(featured[1], 'Mortgage Expert')
})

test('seed: all features enabled by default', () => {
  const freeFeatures = brokerPlans.match(/FREE:\s*\[([\s\S]*?)\]/)
  assert.ok(freeFeatures)
  assert.match(freeFeatures[1], /enabled:\s*true/)
  const disabledCount = (freeFeatures[1].match(/enabled:\s*false/g) || []).length
  assert.equal(disabledCount, 0)
})

// ============================================================================
// SEED: Company Plans
// ============================================================================

test('seed: creates company advertising plans', () => {
  assert.match(seedFile, /seedCompanyAdvertisingPlans/)
  assert.match(seedFile, /DEFAULT_COMPANY_PLANS/)
  assert.match(seedFile, /companyAdvertisingPlan\.create/)
})

test('seed: company plans use CompanyAdvertisingPlan model (not broker)', () => {
  assert.match(seedFile, /prisma\.companyAdvertisingPlan\.findUnique/)
  assert.match(seedFile, /prisma\.companyAdvertisingPlan\.create/)
})

test('seed: company plans are completely separate from broker plans', () => {
  // The seed should never use brokerSubscriptionPlan for company plans
  const seedSection = seedFile.match(/async function seedCompanyAdvertisingPlans\(\)[\s\S]*?\n\}/)
  assert.ok(seedSection)
  assert.doesNotMatch(seedSection[0], /brokerSubscriptionPlan/)
  assert.doesNotMatch(seedSection[0], /BrokerSubscription/)
})

test('seed: has at least one company plan defined', () => {
  assert.match(companyDefs, /DEFAULT_COMPANY_PLANS/)
  const plans = companyDefs.match(/name:\s*'([^']+)'/g)
  assert.ok(plans)
  assert.ok(plans.length >= 1)
})

test('seed: company plan has required fields (name, price, billingInterval)', () => {
  assert.match(companyDefs, /name:\s*string/)
  assert.match(companyDefs, /price:\s*number/)
  assert.match(companyDefs, /billingInterval:\s*string/)
})

// ============================================================================
// SEED: Idempotency
// ============================================================================

test('seed: idempotent - uses findUnique to check existence', () => {
  assert.match(seedFile, /brokerSubscriptionPlan\.findUnique/)
  assert.match(seedFile, /companyAdvertisingPlan\.findUnique/)
})

test('seed: only creates if not existing (no blind delete+recreate)', () => {
  assert.match(seedFile, /if \(!existing\)/)
  // Should NOT have deleteMany for plans in seed
  const seedFunction = seedFile.match(/async function seedSubscriptionPlans[\s\S]*?\n\}/)
  if (seedFunction) {
    assert.doesNotMatch(seedFunction[0], /deleteMany/)
  }
})

test('seed: does not duplicate on re-run', () => {
  // The seed uses findUnique then create - no upsert, so re-runs skip
  assert.match(seedFile, /findUnique.*where.*code/)
  assert.match(seedFile, /findUnique.*where.*name/)
})

// ============================================================================
// SEED: Admin Customization Preservation
// ============================================================================

test('seed: preserves admin-customized feature labels', () => {
  // When plan exists, only adds MISSING features, not overwriting
  assert.match(seedFile, /existingLabels/)
  assert.match(seedFile, /missingFeatures/)
})

test('seed: never overwrites existing feature sortOrder', () => {
  // The seed only creates features that don't exist by label
  const seedFunction = seedFile.match(/async function seedSubscriptionPlans[\s\S]*?\n\}/)
  assert.ok(seedFunction)
  assert.doesNotMatch(seedFunction[0], /update.*sortOrder/)
  assert.doesNotMatch(seedFunction[0], /updateMany/)
})

test('seed: never deletes admin-added features', () => {
  const seedFunction = seedFile.match(/async function seedSubscriptionPlans[\s\S]*?\n\}/)
  assert.ok(seedFunction)
  assert.doesNotMatch(seedFunction[0], /deleteMany/)
})

// ============================================================================
// SEED: Stripe Safety
// ============================================================================

test('seed: no hardcoded fake Stripe IDs', () => {
  // Check for fake/test Stripe IDs
  assert.doesNotMatch(seedFile, /stripePriceId:\s*['"]price_test['"]/)
  assert.doesNotMatch(seedFile, /stripeProductId:\s*['"]prod_test['"]/)
  // Stripe IDs should come from env or be null
  assert.match(seedFile, /process\.env\.STRIPE_STANDARD_PRICE_ID/)
})

test('seed: FEATURED uses env var for Stripe Price ID, FREE has null', () => {
  // Check the seed function has the logic to differentiate
  assert.match(seedFile, /code === 'FEATURED' \?/)
  assert.match(seedFile, /STRIPE_STANDARD_PRICE_ID/)
})

// ============================================================================
// SEED: Plan Identity (immutable)
// ============================================================================

test('seed: uses existing internal codes (FREE, FEATURED)', () => {
  assert.match(brokerPlans, /code:\s*'FREE'/)
  assert.match(brokerPlans, /code:\s*'FEATURED'/)
  // Should NOT introduce MORTGAGE_EXPERT as internal code
  assert.doesNotMatch(brokerPlans, /code:\s*'MORTGAGE_EXPERT'/)
})

// ============================================================================
// REGRESSION: Public APIs
// ============================================================================

test('seed: does not modify public plan API', () => {
  const publicApi = read('app/api/subscription/plans/route.ts')
  assert.match(publicApi, /listBrokerPlansPublic/)
  assert.doesNotMatch(publicApi, /seed/)
})

test('seed: does not modify company plan selection API', () => {
  const companySelect = read('lib/company-plan.ts')
  assert.match(companySelect, /companyAdvertisingPlan/)
})
