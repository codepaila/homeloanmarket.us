import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  BROKER_FREE_PLAN_CODE,
  DEFAULT_BROKER_PLAN_FEATURES,
  DEFAULT_BROKER_PLANS,
  brokerSubscriptionHasProfileBadge,
} from '../lib/broker-plans'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const completion = read('lib/claim-completion.ts')
const invitation = read('lib/claim-invitation.ts')
const claimFlow = read('lib/claim-flow.ts')
const completeRoute = read('app/api/claims/session/complete/route.ts')
const adminCreateRoute = read('app/api/admin/brokers/route.ts')
const brokerData = read('lib/admin/broker-data.ts')
const plansLib = read('lib/broker-plans.ts')
const schema = read('prisma/schema.prisma')

// ---------------------------------------------------------------------------
// ADMIN_CREATED broker creation
// ---------------------------------------------------------------------------

test('admin broker creation does not create a User and links the dynamic FREE plan', () => {
  assert.match(adminCreateRoute, /creationSource: adminCreatedBrokerDefaults\.creationSource/)
  assert.match(adminCreateRoute, /userId: adminCreatedBrokerDefaults\.userId/)
  assert.match(adminCreateRoute, /ensureAdminCreatedBrokerFreeSubscription/)
  assert.doesNotMatch(adminCreateRoute, /user: \{ create:/)
  assert.doesNotMatch(adminCreateRoute, /subscription: \{ create: \{ plan: 'FREE'/)
})

test('admin broker import does not create a User and links the dynamic FREE plan', () => {
  assert.match(brokerData, /creationSource: adminCreatedBrokerDefaults\.creationSource/)
  assert.match(brokerData, /userId: adminCreatedBrokerDefaults\.userId/)
  assert.match(brokerData, /ensureAdminCreatedBrokerFreeSubscription/)
  assert.doesNotMatch(brokerData, /user: \{ create:/)
  assert.doesNotMatch(brokerData, /subscription: \{ create: \{ plan: 'FREE'/)
})

test('admin-created FREE subscription creation never touches Stripe', () => {
  const section = plansLib.slice(plansLib.indexOf('export async function ensureAdminCreatedBrokerFreeSubscription'), plansLib.indexOf('export type AdminBrokerSubscriptionAudit'))
  assert.doesNotMatch(section, /stripe\.customers|stripe\.subscriptions|checkout\.sessions/)
  assert.doesNotMatch(section, /stripeCustomerId/)
})

// ---------------------------------------------------------------------------
// Claim invitation
// ---------------------------------------------------------------------------

test('claim invitation hashes tokens and enforces expiration/revocation/reuse', () => {
  assert.match(invitation, /hashClaimToken\(rawToken\)/)
  assert.match(invitation, /expiresAt = new Date\(Date\.now\(\) \+ CLAIM_INVITATION_DAYS/)
  assert.match(invitation, /status: 'ACTIVE'/)
  assert.match(claimFlow, /status === 'REVOKED'/)
  assert.match(claimFlow, /status === 'USED'/)
  assert.match(claimFlow, /status === 'EXPIRED'/)
  assert.match(claimFlow, /expiresAt <= new Date\(\)/)
})

test('claim invitation revokes prior active invitations (supersede)', () => {
  assert.match(invitation, /status: 'ACTIVE'/ )
  assert.match(invitation, /data: \{ status: 'REVOKED', revokedAt: new Date\(\) \}/)
})

test('claim requires ADMIN_CREATED unowned broker', () => {
  assert.match(claimFlow, /creationSource !== 'ADMIN_CREATED'/)
  assert.match(claimFlow, /broker\.userId/)
})

test('claim flow has race-condition protection via atomic updateMany', () => {
  assert.match(completion, /broker\.updateMany\(\{ where: \{ id: currentInvitation\.claim\.brokerId, userId: null \}/)
})

// ---------------------------------------------------------------------------
// Subscription continuity after claim
// ---------------------------------------------------------------------------

test('claim completion preserves the existing BrokerSubscription', () => {
  // The claim only updates Broker.userId and claim records — never the
  // subscription relation.
  assert.match(completion, /broker\.updateMany\(\{ where: \{ id: currentInvitation\.claim\.brokerId, userId: null \}, data: \{ userId \} \}\)/)
  assert.doesNotMatch(completion, /brokerSubscription\.(update|updateMany|create|delete)/)
  assert.doesNotMatch(completion, /stripeCustomerId|stripeSubId/)
})

test('claim completion does not downgrade the subscription plan', () => {
  assert.doesNotMatch(completion, /plan: 'FREE'|plan: 'FEATURED'|plan: 'PREMIUM'/)
})

test('claim completion returns the actual subscription plan, not a hard-coded value', () => {
  assert.match(completion, /subscription: \{ select: \{ plan: true \} \}/)
  assert.match(completion, /subscriptionPlan: broker\?\.subscription\?\.plan \|\| null/)
})

test('claim complete route no longer hard-codes a FREE subscription plan', () => {
  assert.doesNotMatch(completeRoute, /subscriptionPlan: 'FREE'/)
})

test('claim completion records an audit event', () => {
  assert.match(completion, /eventType: 'COMPLETED'/)
})

test('claim completion protects against duplicate/unauthorized claim', () => {
  assert.match(completion, /if \(currentInvitation\.status === 'USED'\) throw new ClaimFlowError\('USED'\)/)
  assert.match(completion, /if \(currentInvitation\.claim\.status === 'COMPLETED' \|\| currentInvitation\.claim\.broker\.userId\) throw new ClaimFlowError\('OWNED'\)/)
  assert.match(completion, /isClaimRecipientMatch/)
})

// ---------------------------------------------------------------------------
// Dynamic plan single source of truth
// ---------------------------------------------------------------------------

test('entitlement logic derives badge from plan tier, not hard-coded feature booleans', () => {
  // Badge is derived from plan tier (paid vs FREE), not from feature codes.
  assert.match(plansLib, /brokerSubscriptionHasProfileBadge/)
  assert.match(plansLib, /subscription\.plan !== 'FREE'/)
})

test('no runtime entitlement path hard-codes FREE/FEATURED/PREMIUM feature behavior', () => {
  // DEFAULT_BROKER_PLAN_FEATURES is a seed/backfill catalog, not runtime entitlement.
  assert.doesNotMatch(plansLib, /plan === 'FREE'.*return false/)
})

test('dynamic plan is the single source of truth: BrokerSubscription → planId → plan → features', () => {
  assert.match(schema, /model BrokerSubscriptionPlanFeature \{/)
  assert.match(schema, /@@index\(\[planId\]\)/)
  assert.doesNotMatch(schema, /@@unique\(\[planId, code\]\)/)
  assert.match(schema, /planRef\s+BrokerSubscriptionPlan\?/)
})

// ---------------------------------------------------------------------------
// FREE plan behavior
// ---------------------------------------------------------------------------

test('FREE plan has no price and no Stripe', () => {
  const free = DEFAULT_BROKER_PLANS.find((plan) => plan.code === 'FREE')!
  assert.equal(free.price, 0)
  assert.equal(BROKER_FREE_PLAN_CODE, 'FREE')
})

test('FREE feature rows do not list the Mortgage Expert badge display', () => {
  const freeFeatureLabels = DEFAULT_BROKER_PLAN_FEATURES.FREE!.map((f) => f.label)
  assert.equal(freeFeatureLabels.includes('Mortgage Expert Badge + 5 Green Stars'), false)
})

test('the badge is derived from the paid plan tier, not display feature rows', () => {
  const sub = (plan: string) => ({ plan, isActive: true, endDate: null })
  assert.equal(brokerSubscriptionHasProfileBadge(sub('FREE')), false)
  assert.equal(brokerSubscriptionHasProfileBadge(sub('FEATURED')), true)
})

// ---------------------------------------------------------------------------
// Claim / self-registered separation
// ---------------------------------------------------------------------------

test('BrokerRegistrationSubscription remains separate from BrokerSubscription', () => {
  assert.match(schema, /model BrokerRegistrationSubscription \{/)
  const reg = schema.slice(schema.indexOf('model BrokerRegistrationSubscription'), schema.indexOf('model BrokerOnboardingDraft'))
  assert.match(reg, /plan\s+SubscriptionPlan/)
  assert.doesNotMatch(reg, /planRef\s+BrokerSubscriptionPlan/)
})