import assert from 'node:assert/strict'
import test from 'node:test'
import { emailTemplates } from '../lib/email-templates'

test('companySubscriptionPurchased renders active subscription', () => {
  const result = emailTemplates.companySubscriptionPurchased({
    companyName: 'Acme Corp',
    planName: 'ADVERTISING',
    priceCents: 4999,
    currency: 'usd',
    interval: 'month',
    startDate: new Date('2025-09-10T12:00:00Z'),
    endDate: new Date('2025-10-10T12:00:00Z'),
    dashboardUrl: 'https://homeloanmarket.com/company/dashboard',
  })
  assert.ok(result.subject.includes('ADVERTISING'), 'subject mentions plan')
  assert.ok(result.subject.includes('active'), 'subject mentions active')
  assert.ok(result.html.includes('Acme Corp'), 'html contains company name')
  assert.ok(result.html.includes('ADVERTISING'), 'html contains plan name')
  assert.ok(result.html.includes('Active'), 'html contains Active status')
})

test('companySubscriptionPurchased uses company-facing terminology only', () => {
  const result = emailTemplates.companySubscriptionPurchased({
    companyName: 'Test Company',
    planName: 'ADVERTISING',
    priceCents: 4999,
    currency: 'usd',
    interval: 'month',
    startDate: new Date('2025-09-10T12:00:00Z'),
    dashboardUrl: 'https://homeloanmarket.com/company/dashboard',
  })
  assert.ok(!result.html.includes('broker'), 'no broker terminology')
  assert.ok(!result.html.includes('Mortgage Professional'), 'no mortgage professional terminology')
  assert.ok(result.html.includes('company'), 'company terminology present')
})

test('companySubscriptionPurchased does not expose internal IDs', () => {
  const result = emailTemplates.companySubscriptionPurchased({
    companyName: 'Test',
    planName: 'ADVERTISING',
    priceCents: 4999,
    currency: 'usd',
    interval: 'month',
    startDate: new Date('2025-09-10T12:00:00Z'),
    dashboardUrl: 'https://homeloanmarket.com/company/dashboard',
  })
  assert.ok(!result.html.includes('stripe'), 'no Stripe reference')
  assert.ok(!result.html.includes('ObjectId'), 'no ObjectId reference')
  assert.ok(!result.html.includes('db.'), 'no database ID reference')
})

test('companySubscriptionPurchased renders without renewal date', () => {
  const result = emailTemplates.companySubscriptionPurchased({
    companyName: 'Test',
    planName: 'ADVERTISING',
    priceCents: 0,
    currency: 'usd',
    interval: 'month',
    startDate: new Date('2025-09-10T12:00:00Z'),
    endDate: null,
    dashboardUrl: 'https://homeloanmarket.com/company/dashboard',
  })
  assert.ok(result.html.includes('Test'), 'company name present')
  assert.ok(!result.html.includes('Renews On'), 'no renewal date when null')
})

test('companySubscriptionPurchased renders with renewal date', () => {
  const result = emailTemplates.companySubscriptionPurchased({
    companyName: 'Test',
    planName: 'ADVERTISING',
    priceCents: 4999,
    currency: 'usd',
    interval: 'month',
    startDate: new Date('2025-09-10T12:00:00Z'),
    endDate: new Date('2025-10-10T12:00:00Z'),
    dashboardUrl: 'https://homeloanmarket.com/company/dashboard',
  })
  assert.ok(result.html.includes('Renews On'), 'renewal date present')
})

test('companySubscriptionPurchased escapes HTML in company name', () => {
  const result = emailTemplates.companySubscriptionPurchased({
    companyName: '<script>alert("xss")</script>',
    planName: 'ADVERTISING',
    priceCents: 4999,
    currency: 'usd',
    interval: 'month',
    startDate: new Date('2025-09-10T12:00:00Z'),
    dashboardUrl: 'https://homeloanmarket.com/company/dashboard',
  })
  assert.ok(!result.html.includes('<script>'), 'no raw script tag')
})

test('broker subscriptionPurchased template still works unchanged', () => {
  const result = emailTemplates.subscriptionPurchased({
    brokerName: 'John Broker',
    planName: 'FEATURED',
    priceCents: 9900,
    currency: 'usd',
    interval: 'month',
    startDate: new Date('2025-09-10T12:00:00Z'),
    dashboardUrl: 'https://homeloanmarket.com/broker/dashboard',
  })
  assert.ok(result.subject.includes('FEATURED'), 'broker template still works')
  assert.ok(result.html.includes('John Broker'), 'broker name present')
})

test('company and broker templates are independent', () => {
  const companyResult = emailTemplates.companySubscriptionPurchased({
    companyName: 'Acme Corp',
    planName: 'ADVERTISING',
    priceCents: 4999,
    currency: 'usd',
    interval: 'month',
    startDate: new Date('2025-09-10T12:00:00Z'),
    dashboardUrl: 'https://homeloanmarket.com/company/dashboard',
  })
  const brokerResult = emailTemplates.subscriptionPurchased({
    brokerName: 'John Broker',
    planName: 'FEATURED',
    priceCents: 9900,
    currency: 'usd',
    interval: 'month',
    startDate: new Date('2025-09-10T12:00:00Z'),
    dashboardUrl: 'https://homeloanmarket.com/broker/dashboard',
  })
  assert.notEqual(companyResult.subject, brokerResult.subject, 'different subjects')
  assert.ok(companyResult.html.includes('company'), 'company template has company term')
  assert.ok(brokerResult.html.includes('broker') || brokerResult.html.includes('Broker'), 'broker template has broker term')
})
