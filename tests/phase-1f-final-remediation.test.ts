import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

test('Phase 1F C3: company edit passes an explicit broker DTO without subscription relations', () => {
  const page = read('app/broker/company/edit/page.tsx')
  assert.ok(page.includes('const brokerDto ='))
  assert.ok(page.includes('<EditBrokerProfile broker={brokerDto} />'))
  assert.equal(page.includes('subscription:true'), false)
  assert.equal(page.includes('subscription: true'), false)
  assert.equal(page.includes('<EditBrokerProfile broker={brokerProfile} />'), false)
})

test('Phase 1F checkout: Stripe idempotency is server-derived and request remains validated', () => {
  const source = read('app/api/subscription/checkout/route.ts')
  assert.ok(source.includes('validatePlanPrice(plan, priceId)'))
  assert.ok(source.includes('const idempotencyKey = `checkout_${user.id}_${user.brokerProfile.id}_${plan}_${priceId}`'))
  assert.ok(source.includes('idempotencyKey,'))
  assert.ok(source.includes('getCurrentUser()'))
})

test('Phase 1F upgrade: local entitlement is reconciled from Stripe after customer binding', () => {
  const source = read('app/api/subscription/upgrade/route.ts')
  assert.ok(source.includes('subscription.customer !== user.stripeCustomerId'))
  assert.ok(source.includes('SubscriptionService.syncWithStripe(user.brokerProfile.id)'))
  assert.equal(source.includes('prisma.brokerSubscription.update'), false)
})

test('Phase 1F email verification: email-change tokens bind the target email', () => {
  const sender = read('actions/email.action.ts')
  const verifier = read('app/api/auth/verify-email/route.ts')
  assert.ok(sender.includes('update(`${rawToken}:${target}`)'))
  assert.ok(verifier.includes('emailChangeTokenHash'))
  assert.ok(verifier.includes('update(`${token}:${requestedEmail}`)'))
  assert.ok(verifier.includes('emailChangeTokenMatched'))
  assert.ok(verifier.includes('if (emailChangeTokenMatched && requestedEmail'))
})

test('Phase 1F email verification: signup tokens cannot be transformed by URL email', () => {
  const verifier = read('app/api/auth/verify-email/route.ts')
  assert.ok(verifier.includes('hashedToken'))
  assert.ok(verifier.includes('emailVerificationToken: hashedToken'))
  assert.ok(verifier.includes('if (emailChangeTokenMatched && requestedEmail'))
  assert.ok(verifier.includes('emailVerificationToken: null'))
})
