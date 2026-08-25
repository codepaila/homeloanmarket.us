import { mock, test } from 'node:test'
import assert from 'node:assert/strict'

// Runtime verification that Stripe lifecycle events persist the company
// advertising subscription correctly (the webhook's company branch).
const webhookState: {
  companySub: { id: string; companyId: string; planId: string | null; plan: string; stripeCustomerId: string; stripeSubId: string | null; startDate: Date | null } | null
  updated: Record<string, unknown> | null
  companyActivated: boolean
  plan: { id: string; name: string } | null
} = {
  companySub: { id: 'cs-1', companyId: 'company-1', planId: null, plan: 'ADVERTISING', stripeCustomerId: 'cus_test', stripeSubId: null, startDate: null },
  updated: null,
  companyActivated: false,
  plan: null,
}

const getWebhookUpdate = (): Record<string, unknown> | null => webhookState.updated

mock.module('@/lib/prisma', {
  defaultExport: {
    companySubscription: {
      findFirst: async () => webhookState.companySub,
    },
    // updateCompanySubscriptionFromStripe runs inside prisma.$transaction.
    $transaction: async (fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
      fn({
        companySubscription: {
          update: async (args: { data: Record<string, unknown> }) => {
            webhookState.updated = args.data
            return {}
          },
        },
        company: { update: async () => { webhookState.companyActivated = true; return {} } },
      }),
  },
})

mock.module('@/lib/company-plan', {
  namedExports: {
    resolveCompanyPlanByStripePrice: async (priceId: string | null | undefined) =>
      priceId ? webhookState.plan : null,
  },
})

test('webhook: checkout.session.completed persists the company subscription as ACTIVE', async () => {
  const { SubscriptionService } = await import('../lib/subscription')
  webhookState.companySub = { id: 'cs-1', companyId: 'company-1', planId: null, plan: 'ADVERTISING', stripeCustomerId: 'cus_test', stripeSubId: null, startDate: null }
  webhookState.plan = { id: 'plan-1', name: 'Standard Advertising' }
  webhookState.updated = null
  webhookState.companyActivated = false

  await SubscriptionService.updateCompanySubscriptionFromStripe('cus_test', 'sub_test123', 'active', 'price_1U7KTBJubG4mXWM2s6Ivcdl6')

  const updated = getWebhookUpdate()
  assert.ok(updated, 'company subscription updated')
  assert.equal(updated.status, 'ACTIVE')
  assert.equal(updated.isActive, true)
  assert.equal(updated.stripeSubId, 'sub_test123')
  assert.equal(updated.planId, 'plan-1', 'advertising plan resolved from the Stripe price')
  assert.equal(updated.endDate, null)
  assert.equal(webhookState.companyActivated, true, 'company marked ACTIVE after payment')
})

test('webhook: canceled subscription marks the company subscription canceled/inactive', async () => {
  const { SubscriptionService } = await import('../lib/subscription')
  webhookState.companySub = { id: 'cs-1', companyId: 'company-1', planId: 'plan-1', plan: 'Standard Advertising', stripeCustomerId: 'cus_test', stripeSubId: 'sub_test123', startDate: new Date() }
  webhookState.plan = { id: 'plan-1', name: 'Standard Advertising' }
  webhookState.updated = null
  webhookState.companyActivated = false

  await SubscriptionService.updateCompanySubscriptionFromStripe('cus_test', 'sub_test123', 'canceled', 'price_1U7KTBJubG4mXWM2s6Ivcdl6')

  const updated = getWebhookUpdate()
  assert.ok(updated, 'company subscription updated')
  assert.equal(updated.status, 'CANCELED')
  assert.equal(updated.isActive, false)
  assert.ok(updated.endDate instanceof Date, 'endDate set on cancel')
})

test('webhook: past_due maps to PAST_DUE and deactivates', async () => {
  const { SubscriptionService } = await import('../lib/subscription')
  webhookState.companySub = { id: 'cs-1', companyId: 'company-1', planId: 'plan-1', plan: 'Standard Advertising', stripeCustomerId: 'cus_test', stripeSubId: 'sub_test123', startDate: new Date() }
  webhookState.plan = { id: 'plan-1', name: 'Standard Advertising' }
  webhookState.updated = null

  await SubscriptionService.updateCompanySubscriptionFromStripe('cus_test', 'sub_test123', 'past_due', 'price_1U7KTBJubG4mXWM2s6Ivcdl6')

  const updated = getWebhookUpdate()
  assert.ok(updated)
  assert.equal(updated.status, 'PAST_DUE')
  assert.equal(updated.isActive, false)
})