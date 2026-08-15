import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')
const checkout = fs.readFileSync('app/api/company/subscription/checkout/route.ts', 'utf8')
const subscription = fs.readFileSync('lib/subscription.ts', 'utf8')
const plansRoute = fs.readFileSync('app/api/admin/company-advertising-plans/route.ts', 'utf8')

test('company advertising plans use a dedicated model, not the broker SubscriptionPlan enum', () => {
  assert.match(schema, /model CompanyAdvertisingPlan \{/)
  assert.match(schema, /stripePriceId\s+String\?\s+@unique/)
  assert.match(schema, /model CompanySubscription \{/)
  assert.match(schema, /planId\s+String\?\s+@db\.ObjectId/)
  assert.match(schema, /advertisingPlan\s+CompanyAdvertisingPlan\?/)
})

test('broker subscription plan remains the separate SubscriptionPlan enum', () => {
  const brokerSub = schema.slice(schema.indexOf('model BrokerSubscription'), schema.indexOf('model BrokerRegistration'))
  assert.match(brokerSub, /plan\s+SubscriptionPlan/)
  assert.doesNotMatch(brokerSub, /CompanyAdvertisingPlan/)
})

test('company checkout resolves a company advertising plan and uses its Stripe price', () => {
  assert.match(checkout, /resolveCompanyPlanForCheckout/)
  assert.match(checkout, /plan\.stripePriceId/)
  assert.match(checkout, /planId: plan\.id/)
  assert.doesNotMatch(checkout, /getPlanForStripePrice/)
  assert.doesNotMatch(checkout, /SubscriptionPlan/)
})

test('webhook company branch records the advertising plan id from the Stripe price', () => {
  assert.match(subscription, /updateCompanySubscriptionFromStripe/)
  assert.match(subscription, /resolveCompanyPlanByStripePrice\(priceId\)/)
  assert.match(subscription, /planId: plan \? plan\.id : existing\.planId/)
  assert.match(subscription, /this\.updateCompanySubscriptionFromStripe\(\n\s*stripeCustomerId,\n\s*stripeSubscriptionId,\n\s*status,\n\s*planId,/)
})

test('admin plan management is a dedicated company advertising plan API', () => {
  assert.match(plansRoute, /prisma\.companyAdvertisingPlan\.(create|update|findMany)/)
  assert.match(plansRoute, /role !== 'ADMIN'/)
})

test('broker plan resolution never consults company advertising plans', () => {
  // Broker plans resolve from the broker `subscriptionPlans` list, not CompanyAdvertisingPlan.
  const stripeSource = fs.readFileSync('lib/stripe.ts', 'utf8')
  assert.doesNotMatch(stripeSource, /CompanyAdvertisingPlan/)
})

test('company plan helpers are isolated in a dedicated module', () => {
  const companyPlan = fs.readFileSync('lib/company-plan.ts', 'utf8')
  assert.match(companyPlan, /companyAdvertisingPlan\.findMany/)
  assert.match(companyPlan, /companyAdvertisingPlan\.findFirst/)
  assert.doesNotMatch(companyPlan, /brokerSubscription/)
})
