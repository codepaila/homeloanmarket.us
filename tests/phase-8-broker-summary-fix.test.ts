import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  isMortgageExpertBroker,
} from '../lib/broker-policy'
import { brokerSubscriptionHasProfileBadge } from '../lib/broker-plans'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const schema = read('prisma/schema.prisma')
const listingApi = read('app/api/brokers/route.ts')
const plansLib = read('lib/broker-plans.ts')
const publicDto = read('lib/public-broker.ts')

const sub = (plan: string = 'FEATURED', isActive = true, endDate: Date | null = null) =>
  ({ plan, isActive, endDate })

// ---------------------------------------------------------------------------
// 1. Broker feature select does NOT request code
// ---------------------------------------------------------------------------

test('SUMMARY_SELECT does not include code in the features select', () => {
  // The old bug: features.select included { code: true, enabled: true } on
  // BrokerSubscriptionPlanFeature which has no `code` field. The fix removes
  // planRef entirely from the summary select since it is unused.
  assert.doesNotMatch(
    listingApi,
    /features:\s*\{\s*select:\s*\{\s*code:\s*true/,
  )
})

test('SUMMARY_SELECT subscription does not include planRef', () => {
  // The planRef with features was the sole source of the stale `code` reference
  // in summary mode. brokerSubscriptionHasProfileBadge only reads plan + isActive.
  const summarySection = listingApi.slice(
    listingApi.indexOf('const SUMMARY_SELECT'),
    listingApi.indexOf('as const', listingApi.indexOf('SUMMARY_SELECT')),
  )
  assert.doesNotMatch(summarySection, /planRef/)
})

// ---------------------------------------------------------------------------
// 2. Full mode still loads planRef.features for the detail view
// ---------------------------------------------------------------------------

test('full broker mode still loads planRef.features (not affected by the fix)', () => {
  assert.match(listingApi, /planRef: \{ include: \{ features: true \} \}/)
})

// ---------------------------------------------------------------------------
// 3. Existing broker subscription linked to a plan still loads
// ---------------------------------------------------------------------------

test('brokerSubscriptionHasProfileBadge works with subscription plan/isActive', () => {
  assert.equal(brokerSubscriptionHasProfileBadge(sub('FEATURED')), true)
  assert.equal(brokerSubscriptionHasProfileBadge(sub('FREE')), false)
  assert.equal(brokerSubscriptionHasProfileBadge(sub('FEATURED', false)), false)
})

// ---------------------------------------------------------------------------
// 4. Display features return label/enabled/sortOrder (no code)
// ---------------------------------------------------------------------------

test('schema BrokerSubscriptionPlanFeature is display-only without code', () => {
  const featureModel = schema.match(/model BrokerSubscriptionPlanFeature \{[\s\S]*?\}/)?.[0] || ''
  assert.match(featureModel, /label\s+String/)
  assert.match(featureModel, /enabled\s+Boolean/)
  assert.match(featureModel, /sortOrder\s+Int/)
  assert.doesNotMatch(featureModel, /\bcode\b/)
})

// ---------------------------------------------------------------------------
// 5. Mortgage Expert business logic still works
// ---------------------------------------------------------------------------

test('isMortgageExpertBroker derives from profileBadge and mortgageExpertEnabled', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, profileBadge: true }), true)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: true, profileBadge: false }), true)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, profileBadge: false }), false)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: true, profileBadge: true }), true)
})

test('Mortgage Expert badge is NOT derived from feature code rows', () => {
  // The badge is derived from brokerSubscriptionHasProfileBadge (plan tier) OR
  // mortgageExpertEnabled (admin override), never from feature rows.
  assert.match(
    listingApi,
    /brokerSubscriptionHasProfileBadge\(subscription\)/,
  )
  assert.match(
    listingApi,
    /isMortgageExpertBroker\(\{/,
  )
})

// ---------------------------------------------------------------------------
// 6. Admin feature CRUD works with linked broker subscriptions
// ---------------------------------------------------------------------------

test('feature CRUD functions only use label/enabled/sortOrder', () => {
  // createPlanFeatures writes planId, label, enabled, sortOrder — no code
  assert.match(plansLib, /planId,\s*\n\s*label: f\.label/)
  assert.match(plansLib, /enabled: f\.enabled/)
  assert.match(plansLib, /sortOrder:.*f\.sortOrder/)
  // No entitlement code anywhere in feature write operations
  assert.doesNotMatch(plansLib, /code:\s*f\.code/)
})

test('syncPlanFeatures uses label/enabled/sortOrder only', () => {
  assert.match(plansLib, /label: f\.label,\s*enabled: f\.enabled,\s*sortOrder:/)
})

// ---------------------------------------------------------------------------
// 7. CompanyAdvertisingPlan remains unaffected
// ---------------------------------------------------------------------------

test('broker plan features have no reference to CompanyAdvertisingPlan', () => {
  assert.doesNotMatch(plansLib, /CompanyAdvertisingPlan/)
})

// ---------------------------------------------------------------------------
// 8. No Stripe behavior changes
// ---------------------------------------------------------------------------

test('stripe price is resolved from the DB plan, not from feature codes', () => {
  assert.match(plansLib, /stripePriceId/)
  assert.doesNotMatch(plansLib, /feature.*code.*stripe/i)
})

// ---------------------------------------------------------------------------
// 9. API response shape verification
// ---------------------------------------------------------------------------

test('public broker list DTO exposes derived boolean badges, not raw feature data', () => {
  assert.match(publicDto, /isFeatured/)
  assert.match(publicDto, /isMortgageExpert/)
  assert.doesNotMatch(publicDto, /features\.code/)
})

// ---------------------------------------------------------------------------
// 10. No stale feature-code references in the broker API route
// ---------------------------------------------------------------------------

test('broker listing route has no feature code references', () => {
  assert.doesNotMatch(listingApi, /feature.*\.code/)
  assert.doesNotMatch(listingApi, /PROFILE_BADGE/)
  assert.doesNotMatch(listingApi, /SUPPORT_TICKETS/)
})
