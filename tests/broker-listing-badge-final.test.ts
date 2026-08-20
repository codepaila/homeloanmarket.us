import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  isMortgageExpertBroker,
} from '../lib/broker-policy'
import {
  BROKER_PLAN_FEATURES,
  brokerSubscriptionHasFeature,
  planHasFeature,
} from '../lib/broker-plans'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const schema = read('prisma/schema.prisma')
const policy = read('lib/broker-policy.ts')
const plansLib = read('lib/broker-plans.ts')
const listingApi = read('app/api/brokers/route.ts')
const featuredApi = read('app/api/brokers/featured/route.ts')
const brokerDetailApi = read('app/api/brokers/[id]/route.ts')
const companyDetailApi = read('app/api/company/[slug]/route.ts')
const publicDetailPage = read('app/(public)/brokers/[slug]/page.tsx')
const publicListingPage = read('app/(public)/brokers/page.tsx')
const detailClient = read('components/sections/broker/BrokerDetailClient.tsx')
const gridCard = read('components/brokers/BrokerGridCard.tsx')
const listCard = read('components/brokers/BrokerListCard.tsx')
const featuredCard = read('components/brokers/FeaturedBrokerRowCard.tsx')
const adminControl = read('app/admin/brokers/[id]/MortgageExpertControl.tsx')
const adminPage = read('app/admin/brokers/[id]/page.tsx')
const adminRoute = read('app/api/admin/brokers/[id]/mortgage-expert/route.ts')
const claimCompletion = read('lib/claim-completion.ts')
const brokerData = read('lib/admin/broker-data.ts')
const adminCreateRoute = read('app/api/admin/brokers/route.ts')
const publicDto = read('lib/public-broker.ts')

const sub = (features: { code: string; enabled: boolean }[], isActive = true, endDate: Date | null = null) =>
  ({ plan: 'FEATURED', isActive, endDate, planRef: { features } })

// ---------------------------------------------------------------------------
// Effective badge rules
// ---------------------------------------------------------------------------

test('plan PROFILE_BADGE entitlement alone grants the badge', () => {
  assert.equal(brokerSubscriptionHasFeature(sub([{ code: 'PROFILE_BADGE', enabled: true }]), BROKER_PLAN_FEATURES.PROFILE_BADGE), true)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, profileBadge: true }), true)
})

test('admin override alone grants the badge without any paid subscription', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: true, profileBadge: false }), true)
})

test('plan entitlement + admin override together grant the badge', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: true, profileBadge: true }), true)
})

test('admin override works when subscription is FREE (profileBadge false)', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: true, profileBadge: false }), true)
})

test('admin override works when subscription is inactive', () => {
  assert.equal(brokerSubscriptionHasFeature(sub([{ code: 'PROFILE_BADGE', enabled: true }], false), BROKER_PLAN_FEATURES.PROFILE_BADGE), false)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: true, profileBadge: false }), true)
})

test('disabled plan feature removes plan-based entitlement but not the admin override', () => {
  assert.equal(planHasFeature({ features: [{ code: 'PROFILE_BADGE', enabled: false }] }, 'PROFILE_BADGE'), false)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: true, profileBadge: false }), true)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, profileBadge: false }), false)
})

test('disabled individual override removes only the override, not plan entitlement', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, profileBadge: true }), true)
})

test('inactive/expired subscription grants no plan entitlement', () => {
  assert.equal(brokerSubscriptionHasFeature(sub([{ code: 'PROFILE_BADGE', enabled: true }], false), BROKER_PLAN_FEATURES.PROFILE_BADGE), false)
  assert.equal(brokerSubscriptionHasFeature(sub([{ code: 'PROFILE_BADGE', enabled: true }], true, new Date(Date.now() - 1000)), BROKER_PLAN_FEATURES.PROFILE_BADGE), false)
})

// ---------------------------------------------------------------------------
// No static catalog / hard-coded entitlement in the badge path
// ---------------------------------------------------------------------------

test('no static subscription catalog is used for listing entitlement', () => {
  assert.doesNotMatch(listingApi, /from '@\/lib\/stripe'|subscriptionPlans/)
  assert.doesNotMatch(featuredApi, /from '@\/lib\/stripe'|subscriptionPlans/)
  assert.doesNotMatch(brokerDetailApi, /from '@\/lib\/stripe'|subscriptionPlans/)
  assert.doesNotMatch(companyDetailApi, /from '@\/lib\/stripe'|subscriptionPlans/)
})

test('badge entitlement is derived from plan features, never hard-coded FREE/FEATURED/PREMIUM', () => {
  // The listing/detail surfaces resolve the badge via brokerSubscriptionHasFeature + isMortgageExpertBroker.
  assert.match(listingApi, /brokerSubscriptionHasFeature/)
  assert.match(listingApi, /isMortgageExpertBroker/)
  assert.match(featuredApi, /brokerSubscriptionHasFeature/)
  assert.match(companyDetailApi, /brokerSubscriptionHasFeature/)
})

test('the effective badge rule is the single OR of plan feature and admin override', () => {
  assert.match(policy, /state\.profileBadge === true \|\| state\.mortgageExpertEnabled === true/)
})

// ---------------------------------------------------------------------------
// Claim preserves badge
// ---------------------------------------------------------------------------

test('claim completion never mutates the subscription or badge', () => {
  assert.doesNotMatch(claimCompletion, /brokerSubscription\.(update|updateMany|create|delete)/)
  assert.doesNotMatch(claimCompletion, /mortgageExpertEnabled/)
  assert.match(claimCompletion, /broker\.updateMany\(\{ where: \{ id: currentInvitation\.claim\.brokerId, userId: null \}/)
})

// ---------------------------------------------------------------------------
// Imported / admin-created broker preserves badge + FREE subscription
// ---------------------------------------------------------------------------

test('admin-created and imported brokers link the dynamic FREE plan without touching the badge', () => {
  assert.match(adminCreateRoute, /ensureAdminCreatedBrokerFreeSubscription/)
  assert.match(brokerData, /ensureAdminCreatedBrokerFreeSubscription/)
  assert.doesNotMatch(adminCreateRoute, /mortgageExpertEnabled/)
})

// ---------------------------------------------------------------------------
// Listing / profile / API consistency
// ---------------------------------------------------------------------------

test('public listing passes the server-derived isMortgageExpert to cards', () => {
  assert.match(publicListingPage, /isMortgageExpert=\{broker\.isMortgageExpert === true\}/)
})

test('broker profile detail page computes and renders the same effective badge', () => {
  assert.match(publicDetailPage, /isMortgageExpertBroker\(/)
  assert.match(publicDetailPage, /brokerSubscriptionHasFeature/)
  assert.match(detailClient, /isMortgageExpert && <MortgageExpertBadge/)
})

test('all public broker APIs expose the derived isMortgageExpert boolean', () => {
  assert.match(listingApi, /isMortgageExpert:/)
  assert.match(featuredApi, /isMortgageExpert:/)
  assert.match(brokerDetailApi, /isMortgageExpert:/)
  assert.match(companyDetailApi, /isMortgageExpert:/)
})

test('similar-broker cards on the profile page also show the badge', () => {
  assert.match(detailClient, /isMortgageExpert=\{broker\.isMortgageExpert === true\}/)
})

test('internal mortgageExpertEnabled flag is stripped from public DTOs', () => {
  assert.match(publicDto, /mortgageExpertEnabled: _mortgageExpertEnabled/)
})

// ---------------------------------------------------------------------------
// Admin control preserved
// ---------------------------------------------------------------------------

test('admin badge control is preserved and independent', () => {
  assert.match(adminControl, /Enable badge/)
  assert.match(adminControl, /Disable badge/)
  assert.match(adminControl, /isMortgageExpertBroker\(/)
  assert.match(adminPage, /profileBadge=\{brokerDto\.profileBadge\}/)
})

test('admin override API updates only the badge flag, is admin-only', () => {
  assert.match(adminRoute, /data:\s*\{\s*mortgageExpertEnabled:\s*enabled\s*\}/)
  assert.match(adminRoute, /admin\?\.role !== 'ADMIN'/)
  assert.doesNotMatch(adminRoute, /data:[\s\S]*subscription/)
  assert.doesNotMatch(adminRoute, /data:[\s\S]*plan/)
})

// ---------------------------------------------------------------------------
// No duplicate badge logic
// ---------------------------------------------------------------------------

test('cards consume isMortgageExpert and do not recompute entitlement', () => {
  assert.match(gridCard, /isMortgageExpert = false/)
  assert.match(gridCard, /\{isMortgageExpert && <MortgageExpertBadge/)
  assert.match(listCard, /isMortgageExpert = false/)
  assert.match(listCard, /\{isMortgageExpert && <MortgageExpertBadge/)
  assert.match(featuredCard, /broker\.isMortgageExpert && <MortgageExpertBadge/)
  // Cards never infer the badge from subscription plan names.
  assert.doesNotMatch(gridCard, /subscription\?\.plan ===/)
})

// ---------------------------------------------------------------------------
// No N+1: surfaces load planRef.features with the subscription
// ---------------------------------------------------------------------------

test('listing and detail queries include planRef.features to avoid N+1', () => {
  assert.match(listingApi, /planRef: \{ include: \{ features: true \} \}/)
  assert.match(featuredApi, /planRef: \{ include: \{ features: true \} \}/)
  assert.match(companyDetailApi, /planRef: \{ include: \{ features: true \} \}/)
  assert.match(publicDetailPage, /planRef: \{ include: \{ features: true \} \}/)
})

// ---------------------------------------------------------------------------
// No PRO / only existing features
// ---------------------------------------------------------------------------

test('only PROFILE_BADGE and SUPPORT_TICKETS exist; no PRO plan code', () => {
  const enumFeature = plansLib.match(/BROKER_PLAN_FEATURES = \{[\s\S]*?\}/)?.[0] || ''
  assert.match(enumFeature, /PROFILE_BADGE: 'PROFILE_BADGE'/)
  assert.match(enumFeature, /SUPPORT_TICKETS: 'SUPPORT_TICKETS'/)
  // The only feature codes are PROFILE_BADGE and SUPPORT_TICKETS — no PRO plan.
  const codes = (enumFeature.match(/'([A-Z_]+)'/g) || []).map((m) => m.replace(/'/g, ''))
  assert.deepEqual(codes.sort(), ['PROFILE_BADGE', 'SUPPORT_TICKETS'])
})

test('schema keeps exactly the two known features and no PRO plan code', () => {
  const featureModel = schema.match(/model BrokerSubscriptionPlanFeature \{[\s\S]*?\}/)?.[0] || ''
  assert.doesNotMatch(featureModel, /PRO/)
})