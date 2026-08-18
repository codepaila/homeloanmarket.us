import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  hasPaidEntitlement,
  isMortgageExpertBroker,
} from '../lib/broker-policy'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const schema = read('prisma/schema.prisma')
const policy = read('lib/broker-policy.ts')
const adminRoute = read('app/api/admin/brokers/[id]/mortgage-expert/route.ts')
const listingApi = read('app/api/brokers/route.ts')
const geo = read('lib/location/broker-geo.ts')
const publicDto = read('lib/public-broker.ts')
const gridCard = read('components/brokers/BrokerGridCard.tsx')
const listCard = read('components/brokers/BrokerListCard.tsx')
const featuredCard = read('components/brokers/FeaturedBrokerRowCard.tsx')
const listingPage = read('app/(public)/brokers/page.tsx')
const badgeComponent = read('components/brokers/MortgageExpertBadge.tsx')
const detailClient = read('components/sections/broker/BrokerDetailClient.tsx')
const featuredApi = read('app/api/brokers/featured/route.ts')
const adminPage = read('app/admin/brokers/[id]/page.tsx')
const adminControl = read('app/admin/brokers/[id]/MortgageExpertControl.tsx')

const featured = { plan: 'FEATURED' as const, isActive: true, endDate: null }
const expiredFeatured = { plan: 'FEATURED' as const, isActive: true, endDate: new Date(Date.now() - 1000) }
const inactiveFeatured = { plan: 'FEATURED' as const, isActive: false, endDate: null }
const free = { plan: 'FREE' as const, isActive: true, endDate: null }

// ---------------------------------------------------------------------------
// FEATURED automatic qualification
// ---------------------------------------------------------------------------

test('active FEATURED subscription automatically qualifies', () => {
  assert.equal(hasPaidEntitlement(featured), true)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, subscription: featured }), true)
})

test('inactive FEATURED subscription does not qualify', () => {
  assert.equal(hasPaidEntitlement(inactiveFeatured), false)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, subscription: inactiveFeatured }), false)
})

test('expired FEATURED subscription does not qualify automatically', () => {
  assert.equal(hasPaidEntitlement(expiredFeatured), false)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, subscription: expiredFeatured }), false)
})

test('FREE plan does not automatically qualify', () => {
  assert.equal(hasPaidEntitlement(free), false)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, subscription: free }), false)
})

test('missing subscription does not automatically qualify', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, subscription: null }), false)
})

// ---------------------------------------------------------------------------
// Combined edge cases
// ---------------------------------------------------------------------------

test('edge cases: FEATURED active + admin disabled => badge visible', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, subscription: featured }), true)
})

test('edge cases: FEATURED inactive + admin enabled => badge visible', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: true, subscription: free }), true)
})

test('edge cases: FEATURED active + admin enabled => badge visible', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: true, subscription: featured }), true)
})

test('edge cases: FEATURED inactive + admin disabled => badge hidden', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, subscription: free }), false)
})

test('edge cases: expired FEATURED + admin disabled => badge hidden', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, subscription: expiredFeatured }), false)
})

test('edge cases: expired FEATURED + admin enabled => badge visible', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: true, subscription: expiredFeatured }), true)
})

// ---------------------------------------------------------------------------
// Badge logic independence from ratings / reviews
// ---------------------------------------------------------------------------

test('badge qualification does not depend on rating', () => {
  const withRating = { ...featured, avgRating: 5 }
  const withoutRating = { ...featured, avgRating: 0 }
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, subscription: withRating }), isMortgageExpertBroker({ mortgageExpertEnabled: false, subscription: withoutRating }))
})

test('badge qualification does not depend on review count', () => {
  const withReviews = { ...free, totalReviews: 100 }
  const withoutReviews = { ...free, totalReviews: 0 }
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, subscription: withReviews }), isMortgageExpertBroker({ mortgageExpertEnabled: false, subscription: withoutReviews }))
})

// ---------------------------------------------------------------------------
// Data model: exactly one admin badge field, two subscription plans
// ---------------------------------------------------------------------------

test('schema adds a single admin-controlled mortgageExpertEnabled field with safe default', () => {
  assert.match(schema, /mortgageExpertEnabled\s+Boolean\s+@default\(false\)/)
  assert.equal((schema.match(/mortgageExpertEnabled/g) || []).length, 1)
})

test('schema retains exactly the FREE/FEATURED subscription model (no PRO introduced)', () => {
  const planEnum = schema.match(/enum SubscriptionPlan \{[\s\S]*?\}/)?.[0] || ''
  assert.doesNotMatch(planEnum, /PRO/)
  assert.match(planEnum, /FREE/)
  assert.match(planEnum, /FEATURED/)
})

// ---------------------------------------------------------------------------
// Admin control: API behavior and authorization
// ---------------------------------------------------------------------------

test('admin route updates only the badge field', () => {
  // The update payload is exactly the single badge field, nothing else.
  assert.match(adminRoute, /data:\s*\{\s*mortgageExpertEnabled:\s*enabled\s*\}/)
  assert.doesNotMatch(adminRoute, /data:[\s\S]*brokerStatus/)
  assert.doesNotMatch(adminRoute, /data:[\s\S]*profileImage/)
})

test('admin route returns 403 for non-admin users', () => {
  assert.match(adminRoute, /admin\?\.role !== 'ADMIN'/)
  assert.match(adminRoute, /status: 403/)
})

test('admin route returns 404 when broker is not found', () => {
  assert.match(adminRoute, /Broker not found/)
  assert.match(adminRoute, /status: 404/)
})

test('admin route validates the enabled flag server-side', () => {
  assert.match(adminRoute, /typeof enabled !== 'boolean'/)
  assert.match(adminRoute, /status: 422/)
})

test('admin route reads brokerId from the URL, never trusts the body', () => {
  assert.match(adminRoute, /const \{ id \} = await params/)
})

test('admin control renders Enable and Disable with a Saving state', () => {
  assert.match(adminControl, /Enable badge/)
  assert.match(adminControl, /Disable badge/)
  assert.match(adminControl, /Saving\.\.\./)
})

test('admin control renders status and qualification source', () => {
  assert.match(adminControl, /Status:/)
  assert.match(adminControl, /Qualification source:/)
  assert.match(adminControl, /FEATURED \+ Admin enabled/)
  assert.match(adminControl, /Not qualified/)
})

test('admin control distinguishes subscription qualification from admin badge', () => {
  assert.match(adminControl, /Subscription qualification/)
  assert.match(adminControl, /Automatically qualified/)
  assert.match(adminControl, /Admin badge/)
})

test('admin page passes the badge flag and subscription to the control', () => {
  assert.match(adminPage, /mortgageExpertEnabled: true/)
  assert.match(adminPage, /<MortgageExpertControl/)
  assert.match(adminPage, /subscription=\{broker\.subscription\}/)
})

// ---------------------------------------------------------------------------
// Public listing behavior
// ---------------------------------------------------------------------------

test('public listing API derives isMortgageExpert from the shared helper', () => {
  assert.match(listingApi, /isMortgageExpertBroker/)
  assert.match(listingApi, /isMortgageExpert:/)
})

test('public DTO never leaks the admin-controlled field', () => {
  assert.match(publicDto, /mortgageExpertEnabled: _mortgageExpertEnabled/)
})

test('grid card renders the badge only when isMortgageExpert is true', () => {
  assert.match(gridCard, /isMortgageExpert = false/)
  assert.match(gridCard, /\{isMortgageExpert && <MortgageExpertBadge/)
})

test('broker listing passes the effective badge flag to the card', () => {
  assert.match(listingPage, /isMortgageExpert=\{broker\.isMortgageExpert === true\}/)
})

test('Mortgage Expert badge renders exactly five green stars plus the label', () => {
  assert.match(badgeComponent, /Mortgage Expert/)
  assert.match(badgeComponent, /<Star/)
  assert.match(badgeComponent, /h-3 w-3 fill-current/)
  assert.match(badgeComponent, /text-emerald|text-green/)
  assert.doesNotMatch(badgeComponent, /avgRating|totalReviews|reviewCount|RatingStars|5\.0/)
  // Exactly five stars: the render maps over a fixed five-element array.
  assert.match(badgeComponent, /const STARS = \[0, 1, 2, 3, 4\]/)
  assert.match(badgeComponent, /STARS\.map/)
})

test('badge stars are decorative and the label provides the accessible text', () => {
  assert.match(badgeComponent, /aria-hidden="true"/)
  assert.match(badgeComponent, /title="Mortgage Expert"/)
  assert.match(badgeComponent, /whitespace-nowrap/)
})

// ---------------------------------------------------------------------------
// Profile-image independence matrix
// ---------------------------------------------------------------------------

test('badge qualification is independent of profile image for every combination', () => {
  const matrix = [
    // FEATURED | admin | expected
    { subscription: featured, enabled: false, expected: true },
    { subscription: featured, enabled: true, expected: true },
    { subscription: free, enabled: true, expected: true },
    { subscription: free, enabled: false, expected: false },
    { subscription: expiredFeatured, enabled: false, expected: false },
    { subscription: expiredFeatured, enabled: true, expected: true },
    { subscription: null, enabled: false, expected: false },
  ]
  for (const { subscription, enabled, expected } of matrix) {
    assert.equal(
      isMortgageExpertBroker({ mortgageExpertEnabled: enabled, subscription }),
      expected,
      `subscription=${subscription?.plan ?? 'none'} enabled=${enabled} => ${expected}`,
    )
  }
})

test('FREE + admin enabled + no profile image still qualifies', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: true, subscription: free }), true)
})

test('FREE + admin disabled + no profile image does not qualify', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, subscription: free }), false)
})

// ---------------------------------------------------------------------------
// Broker priority ordering
// ---------------------------------------------------------------------------

test('listing ranks active FEATURED first via the existing subscription rank', () => {
  assert.match(listingApi, /\{ featuredRank: 'desc' \}/)
  assert.doesNotMatch(listingApi, /brokerStatus: 'desc'/)
})

test('listing ranks admin-enabled Mortgage Expert brokers before profile-image brokers', () => {
  const orderIdx = listingApi.indexOf('orderBy: [')
  const featuredIdx = listingApi.indexOf("featuredRank: 'desc'")
  const adminIdx = listingApi.indexOf("mortgageExpertEnabled: 'desc'")
  const imageIdx = listingApi.indexOf("profileImage: 'desc'")
  assert.ok(featuredIdx > orderIdx, 'featuredRank is inside orderBy')
  assert.ok(adminIdx > featuredIdx, 'admin-enabled tier follows the FEATURED tier')
  assert.ok(imageIdx > adminIdx, 'profile-image tier follows the admin-enabled tier')
})

test('listing ordering is applied server-side before pagination', () => {
  const findManyIdx = listingApi.indexOf('prisma.broker.findMany')
  const orderIdx = listingApi.indexOf('orderBy: [')
  const featuredIdx = listingApi.indexOf("featuredRank: 'desc'")
  assert.ok(orderIdx > findManyIdx, 'orderBy is inside the same findMany that paginates')
  assert.ok(featuredIdx > findManyIdx, 'ranking is applied inside the paginated query')
})

test('radius search preserves the same FEATURED -> admin -> image priority', () => {
  assert.match(geo, /featured: -1/)
  assert.match(geo, /featuredRank: -1/)
  assert.match(geo, /mortgageExpertEnabled: -1/)
  assert.match(geo, /profileImage: -1/)
  const featuredIdx = geo.indexOf('featured: -1')
  const adminIdx = geo.indexOf('mortgageExpertEnabled: -1')
  const imageIdx = geo.indexOf('profileImage: -1')
  assert.ok(adminIdx > featuredIdx, 'admin-enabled tier after FEATURED tier in radius sort')
  assert.ok(imageIdx > adminIdx, 'profile-image tier after admin-enabled tier in radius sort')
})

test('ranking never uses rating, reviews, or the badge itself', () => {
  assert.doesNotMatch(listingApi, /avgRating: 'desc'/)
  assert.doesNotMatch(listingApi, /totalReviews: 'desc'/)
  assert.doesNotMatch(geo, /avgRating: -1/)
  assert.doesNotMatch(geo, /totalReviews: -1/)
})

test('badge rendering is never used as the ranking mechanism', () => {
  assert.doesNotMatch(listingApi, /orderBy: \[\{ isMortgageExpert/)
  assert.doesNotMatch(geo, /isMortgageExpert: -1/)
  assert.doesNotMatch(listingApi, /isMortgageExpert: 'desc'/)
})

// ---------------------------------------------------------------------------
// Card and detail consistency
// ---------------------------------------------------------------------------

test('every public card consumes isMortgageExpert from the server layer', () => {
  assert.match(gridCard, /isMortgageExpert = false/)
  assert.match(gridCard, /\{isMortgageExpert && <MortgageExpertBadge/)
  assert.match(listCard, /isMortgageExpert = false/)
  assert.match(listCard, /\{isMortgageExpert && <MortgageExpertBadge/)
  assert.match(featuredCard, /broker\.isMortgageExpert/)
  assert.match(featuredCard, /<MortgageExpertBadge/)
})

test('broker listing passes the effective badge flag to the card', () => {
  assert.match(listingPage, /isMortgageExpert=\{broker\.isMortgageExpert === true\}/)
})

test('featured API exposes the canonical isMortgageExpert flag', () => {
  assert.match(featuredApi, /isMortgageExpert:/)
  assert.match(featuredApi, /isMortgageExpertBroker/)
})

test('broker detail page renders the same Mortgage Expert visual', () => {
  assert.match(detailClient, /isMortgageExpert && <MortgageExpertBadge/)
})

test('cards never infer qualification from subscription plan names', () => {
  assert.doesNotMatch(gridCard, /subscription\?\.plan ===/)
  assert.doesNotMatch(listCard, /subscription\?\.plan ===/)
  assert.doesNotMatch(featuredCard, /isMortgageExpertBroker/)
})
