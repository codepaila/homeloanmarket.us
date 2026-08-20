import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

test('company accounts use dedicated models without a broker or advertiser role', () => {
  const schema = read('prisma/schema.prisma')
  const registration = read('app/api/company/register/route.ts')
  const dashboard = read('app/company/dashboard/CompanyDashboardClient.tsx')
  assert.match(schema, /model Company \{/)
  assert.match(schema, /model CompanyMembership \{/)
  assert.match(schema, /model CompanySubscription \{/)
  assert.match(schema, /model CompanyAdRequest \{/)
  assert.doesNotMatch(schema, /ADVERTISER/) 
  assert.match(registration, /role: 'USER'/)
  assert.doesNotMatch(registration, /role: 'BROKER'/)
  assert.match(dashboard, /Subscription & Billing/)
  assert.match(dashboard, /Advertisement Request/)
})

test('company billing is separate, recurring, and coupon-capable', () => {
  const checkout = read('app/api/company/subscription/checkout/route.ts')
  const cancel = read('app/api/company/subscription/cancel/route.ts')
  const webhook = read('lib/subscription.ts')
  assert.match(checkout, /companySubscription/)
  assert.match(checkout, /mode: 'subscription'/)
  // The discount is server-validated and server-applied (coupon). Client
  // promotion codes entered at the Stripe UI are disabled so the client cannot
  // inject an arbitrary discount.
  assert.match(checkout, /validateCompanyCoupon/)
  assert.match(checkout, /allow_promotion_codes: false/)
  assert.match(cancel, /company:/)
  assert.match(webhook, /updateCompanySubscriptionFromStripe/)
})
