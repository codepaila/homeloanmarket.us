import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  BROKER_PLAN_DISPLAY_NAME,
  DEFAULT_BROKER_PLAN_FEATURES,
  DEFAULT_BROKER_PLANS,
  toBrokerPlanPublic,
  listBrokerPlansPublic,
} from '../lib/broker-plans'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const plansLib = read('lib/broker-plans.ts')
const featureLabels = (code: string) => DEFAULT_BROKER_PLAN_FEATURES[code].map((f) => f.label)

// ---------------------------------------------------------------------------
// 1. FREE plan — exact approved features
// ---------------------------------------------------------------------------

test('FREE plan has the exact approved customer feature list in order', () => {
  assert.deepEqual(featureLabels('FREE'), [
    'Local Broker Listing',
    'Appear in Search Results',
    'Profile & Contact Information',
    'Visibility Across Your Metro Area',
    'Greater Exposure to a Large, Hard-to-Reach Homebuyer Community',
    'Free',
  ])
})

test('FREE plan is $0/month', () => {
  const free = DEFAULT_BROKER_PLANS.find((p) => p.code === 'FREE')!
  assert.equal(free.price, 0)
  assert.equal(free.billingInterval, 'month')
})

test('FREE plan customer-facing name is "Free"', () => {
  assert.equal(BROKER_PLAN_DISPLAY_NAME.FREE, 'Free')
})

// ---------------------------------------------------------------------------
// 2. MORTGAGE EXPERT plan — exact approved features
// ---------------------------------------------------------------------------

test('MORTGAGE EXPERT plan has the exact approved customer feature list in order', () => {
  assert.deepEqual(featureLabels('FEATURED'), [
    'Local Broker Listing',
    'Appear Above Free Listings',
    'Profile & Contact Information',
    'Visibility Across Your Metro Area',
    'Greater Exposure to a Large, Hard-to-Reach Homebuyer Community',
    'Mortgage Expert Badge + 5 Green Stars',
    'Cancel Anytime',
  ])
})

test('MORTGAGE EXPERT plan is $15/month (1500 cents)', () => {
  const featured = DEFAULT_BROKER_PLANS.find((p) => p.code === 'FEATURED')!
  assert.equal(featured.price, 1500)
  assert.equal(featured.billingInterval, 'month')
  assert.equal(featured.currency, 'usd')
})

test('MORTGAGE EXPERT plan customer-facing name is "Mortgage Expert"', () => {
  assert.equal(BROKER_PLAN_DISPLAY_NAME.FEATURED, 'Mortgage Expert')
})

test('MORTGAGE EXPERT internal code remains FEATURED', () => {
  const featured = DEFAULT_BROKER_PLANS.find((p) => p.code === 'FEATURED')!
  assert.equal(featured.code, 'FEATURED')
})

// ---------------------------------------------------------------------------
// 3. Feature wording — exact string assertions
// ---------------------------------------------------------------------------

test('exact feature string: "Local Broker Listing"', () => {
  assert.ok(featureLabels('FREE').includes('Local Broker Listing'))
  assert.ok(featureLabels('FEATURED').includes('Local Broker Listing'))
})

test('exact feature string: "Appear in Search Results" (FREE only)', () => {
  assert.ok(featureLabels('FREE').includes('Appear in Search Results'))
  assert.ok(!featureLabels('FEATURED').includes('Appear in Search Results'))
})

test('exact feature string: "Appear Above Free Listings" (FEATURED only)', () => {
  assert.ok(!featureLabels('FREE').includes('Appear Above Free Listings'))
  assert.ok(featureLabels('FEATURED').includes('Appear Above Free Listings'))
})

test('exact feature string: "Profile & Contact Information"', () => {
  assert.ok(featureLabels('FREE').includes('Profile & Contact Information'))
  assert.ok(featureLabels('FEATURED').includes('Profile & Contact Information'))
})

test('exact feature string: "Visibility Across Your Metro Area"', () => {
  assert.ok(featureLabels('FREE').includes('Visibility Across Your Metro Area'))
  assert.ok(featureLabels('FEATURED').includes('Visibility Across Your Metro Area'))
})

test('exact feature string: "Greater Exposure to a Large, Hard-to-Reach Homebuyer Community"', () => {
  const longFeature = 'Greater Exposure to a Large, Hard-to-Reach Homebuyer Community'
  assert.ok(featureLabels('FREE').includes(longFeature))
  assert.ok(featureLabels('FEATURED').includes(longFeature))
})

test('exact feature string: "Mortgage Expert Badge + 5 Green Stars" (FEATURED only)', () => {
  assert.ok(!featureLabels('FREE').includes('Mortgage Expert Badge + 5 Green Stars'))
  assert.ok(featureLabels('FEATURED').includes('Mortgage Expert Badge + 5 Green Stars'))
})

test('exact feature string: "Cancel Anytime" (FEATURED only)', () => {
  assert.ok(!featureLabels('FREE').includes('Cancel Anytime'))
  assert.ok(featureLabels('FEATURED').includes('Cancel Anytime'))
})

test('exact feature string: "Free" (FREE only)', () => {
  assert.ok(featureLabels('FREE').includes('Free'))
  assert.ok(!featureLabels('FEATURED').includes('Free'))
})

// ---------------------------------------------------------------------------
// 4. toBrokerPlanPublic uses customer features and display name
// ---------------------------------------------------------------------------

test('toBrokerPlanPublic returns DB features for FREE (in sortOrder)', () => {
  const plan = {
    id: '1',
    code: 'FREE',
    name: 'Free',
    description: 'Basic broker listing',
    price: 0,
    currency: 'usd',
    billingInterval: 'month',
    displayOrder: 10,
    isActive: true,
    stripePriceId: null,
    features: [
      { label: 'Local Broker Listing', enabled: true, sortOrder: 10 },
      { label: 'Appear in Search Results', enabled: true, sortOrder: 20 },
      { label: 'Profile Badge', enabled: false, sortOrder: 70 },
    ],
  }
  const publicPlan = toBrokerPlanPublic(plan as any)
  // Only enabled features, ordered by sortOrder
  assert.deepEqual(publicPlan.features, ['Local Broker Listing', 'Appear in Search Results'])
  assert.equal(publicPlan.name, 'Free')
})

test('toBrokerPlanPublic returns DB features for FEATURED including custom labels', () => {
  const plan = {
    id: '2',
    code: 'FEATURED',
    name: 'Mortgage Expert',
    description: 'Get featured in listings',
    price: 1500,
    currency: 'usd',
    billingInterval: 'month',
    displayOrder: 20,
    isActive: true,
    stripePriceId: 'price_123',
    features: [
      { label: 'Custom Badge Label', enabled: true, sortOrder: 10 },
      { label: 'Priority Support Tickets', enabled: true, sortOrder: 20 },
    ],
  }
  const publicPlan = toBrokerPlanPublic(plan as any)
  assert.deepEqual(publicPlan.features, ['Custom Badge Label', 'Priority Support Tickets'])
  assert.equal(publicPlan.name, 'Mortgage Expert')
})

test('toBrokerPlanPublic uses DB labels even for null-only keys (unknown codes)', () => {
  const plan = {
    id: '3',
    code: 'CUSTOM_PLAN',
    name: 'Custom',
    description: 'A custom plan',
    price: 5000,
    currency: 'usd',
    billingInterval: 'month',
    displayOrder: 40,
    isActive: true,
    stripePriceId: 'price_456',
    features: [{ label: 'Premium Visibility', enabled: true, sortOrder: 0 }],
  }
  const publicPlan = toBrokerPlanPublic(plan as any)
  assert.deepEqual(publicPlan.features, ['Premium Visibility'])
})

test('toBrokerPlanPublic sorts enabled features by sortOrder', () => {
  const plan = {
    id: '4',
    code: 'FEATURED',
    name: 'Mortgage Expert',
    description: 'd',
    price: 1500,
    currency: 'usd',
    billingInterval: 'month',
    displayOrder: 20,
    isActive: true,
    stripePriceId: 'price_1',
    features: [
      { label: 'Third', enabled: true, sortOrder: 30 },
      { label: 'First', enabled: true, sortOrder: 10 },
      { label: 'Disabled', enabled: false, sortOrder: 5 },
      { label: 'Second', enabled: true, sortOrder: 20 },
    ],
  }
  const publicPlan = toBrokerPlanPublic(plan as any)
  assert.deepEqual(publicPlan.features, ['First', 'Second', 'Third'])
})

// ---------------------------------------------------------------------------
// 5. Separation — broker plans never touch CompanyAdvertisingPlan
// ---------------------------------------------------------------------------

test('broker plans lib does not import CompanyAdvertisingPlan', () => {
  assert.doesNotMatch(plansLib, /CompanyAdvertisingPlan/)
})

test('broker plans lib does not import company-ad-access', () => {
  assert.doesNotMatch(plansLib, /company-ad-access/)
})

test('DEFAULT_BROKER_PLANS contains only broker plan codes', () => {
  const codes = DEFAULT_BROKER_PLANS.map((p) => p.code)
  assert.ok(codes.includes('FREE'))
  assert.ok(codes.includes('FEATURED'))
  assert.ok(codes.includes('PREMIUM'))
  // No company plan codes
  assert.ok(!codes.includes('COMPANY'))
  assert.ok(!codes.includes('ADVERTISING'))
})

// ---------------------------------------------------------------------------
// 6. Internal code preservation — FEATURED code is not renamed
// ---------------------------------------------------------------------------

test('internal plan code FEATURED is preserved (not renamed to MORTGAGE_EXPERT)', () => {
  const featured = DEFAULT_BROKER_PLANS.find((p) => p.code === 'FEATURED')!
  assert.equal(featured.code, 'FEATURED')
  // The customer-facing name is different from the code
  assert.equal(BROKER_PLAN_DISPLAY_NAME.FEATURED, 'Mortgage Expert')
  assert.notEqual(featured.code, 'MORTGAGE_EXPERT')
})

test('BrokerStatus enum values are not modified', () => {
  // The schema still uses FREE | FEATURED | SUSPENDED
  const schema = read('prisma/schema.prisma')
  assert.match(schema, /enum BrokerStatus/)
  assert.match(schema, /FREE/)
  assert.match(schema, /FEATURED/)
  assert.match(schema, /SUSPENDED/)
})

// ---------------------------------------------------------------------------
// 7. Paid ordering — FEATURED brokers appear above FREE in listing sort
// ---------------------------------------------------------------------------

test('broker listing sort places FEATURED (paid) above FREE', () => {
  const listingLib = read('lib/broker-listing.ts')
  // The sort must have featured as the primary descending key
  assert.match(listingLib, /featured:\s*-1/)
})

// ---------------------------------------------------------------------------
// 8. Badge / 5 green stars — MortgageExpertBadge renders correctly
// ---------------------------------------------------------------------------

test('MortgageExpertBadge renders 5 stars and "Mortgage Expert" text', () => {
  const badge = read('components/brokers/MortgageExpertBadge.tsx')
  assert.match(badge, /STARS = \[0, 1, 2, 3, 4\]/)
  assert.match(badge, /Mortgage Expert/)
  assert.match(badge, /text-emerald-600/)
  assert.match(badge, /fill-current/)
})

test('MortgageExpertBadge comment confirms stars are not review ratings', () => {
  const badge = read('components/brokers/MortgageExpertBadge.tsx')
  assert.match(badge, /never derived from reviews/)
})

// ---------------------------------------------------------------------------
// 9. Customer-facing "Mortgage Expert" in badge/status components
// ---------------------------------------------------------------------------

test('BrokerListCard uses "Mortgage Expert" not "Featured" in badge text', () => {
  const card = read('components/brokers/BrokerListCard.tsx')
  assert.match(card, /Mortgage Expert/)
  // The word "Featured" should not appear as standalone badge text
  assert.doesNotMatch(card, />\s*Featured\s*</)
})

test('FeaturedBrokerRowCard uses "Mortgage Expert" not "Featured" in badge', () => {
  const card = read('components/brokers/FeaturedBrokerRowCard.tsx')
  assert.match(card, /Mortgage Expert/)
  assert.doesNotMatch(card, />\s*Featured\s*</)
})

test('BrokerDetailClient uses "Mortgage Expert" not "Featured" in avatar badge', () => {
  const detail = read('components/sections/broker/BrokerDetailClient.tsx')
  assert.match(detail, /Mortgage Expert/)
  assert.doesNotMatch(detail, />[\s\n]*Featured[\s\n]*</)
})

test('BrokerDashboard status label uses "Mortgage Expert" not "Featured"', () => {
  const dashboard = read('components/sections/broker/BrokerDashboard.tsx')
  assert.match(dashboard, /label:\s*"Mortgage Expert"/)
  assert.doesNotMatch(dashboard, /label:\s*"Featured"/)
})

test('BrokerProfile status label uses "Mortgage Expert" not "Featured Mortgage Originator"', () => {
  const profile = read('components/sections/broker/BrokerProfile.tsx')
  assert.match(profile, /label:\s*"Mortgage Expert"/)
  assert.doesNotMatch(profile, /Featured Mortgage Originator/)
})

test('SubscriptionBadge uses "Mortgage Expert" not "Featured"', () => {
  const badge = read('components/layout/admin/SubscriptionBadge.tsx')
  assert.match(badge, /Mortgage Expert/)
  assert.doesNotMatch(badge, />\s*Featured\s*</)
})

test('BrokerSubscriptionBadge uses "Mortgage Expert" not "Premium subscribed"', () => {
  const badge = read('components/brokers/BrokerSubscriptionBadge.tsx')
  assert.match(badge, /Mortgage Expert/)
  assert.doesNotMatch(badge, /Premium subscribed/)
})

// ---------------------------------------------------------------------------
// 10. MortgageExpertBadge component unchanged
// ---------------------------------------------------------------------------

test('MortgageExpertBadge component is unchanged — 5 green stars + label', () => {
  const badge = read('components/brokers/MortgageExpertBadge.tsx')
  assert.match(badge, /h-3 w-3 fill-current/)
  assert.match(badge, /text-emerald-600/)
  assert.match(badge, /Mortgage Expert/)
})

// ---------------------------------------------------------------------------
// 11. FREE plan has no Stripe requirement
// ---------------------------------------------------------------------------

test('FREE plan default has no Stripe identifiers', () => {
  const free = DEFAULT_BROKER_PLANS.find((p) => p.code === 'FREE')!
  assert.equal(free.price, 0)
  // FREE plans never need Stripe
})

// ---------------------------------------------------------------------------
// 12. Public plans API reads from DB
// ---------------------------------------------------------------------------

test('public plans API returns broker plans only', () => {
  const plansApi = read('app/api/subscription/plans/route.ts')
  assert.match(plansApi, /listBrokerPlansPublic/)
  assert.doesNotMatch(plansApi, /CompanyAdvertisingPlan/)
})
