import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  isMortgageExpertBroker,
} from '../lib/broker-policy'
import { brokerSubscriptionHasProfileBadge } from '../lib/broker-plans'

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

const sub = (plan: string = 'FEATURED', isActive = true, endDate: Date | null = null) =>
  ({ plan, isActive, endDate })

// ---------------------------------------------------------------------------
// Effective badge rules
// ---------------------------------------------------------------------------

test('paid plan subscription alone grants the badge', () => {
  assert.equal(brokerSubscriptionHasProfileBadge(sub('FEATURED')), true)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, profileBadge: true }), true)
})

test('FREE plan subscription alone grants no badge', () => {
  assert.equal(brokerSubscriptionHasProfileBadge(sub('FREE')), false)
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
  assert.equal(brokerSubscriptionHasProfileBadge(sub('FEATURED', false)), false)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: true, profileBadge: false }), true)
})

test('display feature rows never gate the badge; only plan tier does', () => {
  // Badge entitlement is derived from the plan tier, not display feature rows.
  assert.equal(brokerSubscriptionHasProfileBadge(sub('FEATURED')), true)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: true, profileBadge: false }), true)
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, profileBadge: false }), false)
})

test('disabled individual override removes only the override, not plan entitlement', () => {
  assert.equal(isMortgageExpertBroker({ mortgageExpertEnabled: false, profileBadge: true }), true)
})

test('inactive/expired subscription grants no plan entitlement', () => {
  assert.equal(brokerSubscriptionHasProfileBadge(sub('FEATURED', false)), false)
  assert.equal(brokerSubscriptionHasProfileBadge(sub('FEATURED', true, new Date(Date.now() - 1000))), false)
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

test('badge entitlement is derived from the paid plan tier, never hard-coded FREE/FEATURED/PREMIUM', () => {
  // The listing/detail surfaces resolve the badge via brokerSubscriptionHasProfileBadge + isMortgageExpertBroker.
  assert.match(listingApi, /brokerSubscriptionHasProfileBadge/)
  assert.match(listingApi, /isMortgageExpertBroker/)
  assert.match(featuredApi, /brokerSubscriptionHasProfileBadge/)
  assert.match(companyDetailApi, /brokerSubscriptionHasProfileBadge/)
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
  assert.match(publicDetailPage, /brokerSubscriptionHasProfileBadge/)
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
  // The public DTO is an explicit allowlist; the raw admin-controlled
  // mortgageExpertEnabled flag must never appear in it.
  assert.doesNotMatch(publicDto, /mortgageExpertEnabled/)
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

test('no entitlement feature codes exist; the badge derives from plan tier; no PRO plan', () => {
  // Code-based feature/BROKER_PLAN_FEATURES entitlement is gone.
  assert.doesNotMatch(plansLib, /SUPPORT_TICKETS/)
  assert.doesNotMatch(plansLib, /PROFILE_BADGE: 'PROFILE_BADGE'/)
  // No PRO entitlement / plan code exists.
  assert.doesNotMatch(plansLib, /'PRO'/g)
})

test('schema BrokerSubscriptionPlanFeature is display-only (label/enabled/sortOrder, no code, no PRO)', () => {
  const featureModel = schema.match(/model BrokerSubscriptionPlanFeature \{[\s\S]*?\}/)?.[0] || ''
  assert.match(featureModel, /label\s+String/)
  assert.match(featureModel, /enabled\s+Boolean/)
  assert.match(featureModel, /sortOrder\s+Int/)
  assert.doesNotMatch(featureModel, /PRO/)
})