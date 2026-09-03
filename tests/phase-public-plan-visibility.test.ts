import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readFile = (path: string) => fs.readFileSync(path, 'utf8')

const publicApi = readFile('app/api/subscription/plans/route.ts')
const subscriptionPage = readFile('app/broker/subscription/page.tsx')

test('Public plans API does not require authentication', () => {
  assert.doesNotMatch(publicApi, /getAdminUser/)
  assert.doesNotMatch(publicApi, /getCurrentUser/)
  assert.doesNotMatch(publicApi, /Unauthorized/)
  assert.match(publicApi, /listBrokerPlansPublic/)
})

test('Public plans API returns success response', () => {
  assert.match(publicApi, /success: true/)
  assert.match(publicApi, /plans/)
})

test('Subscription page allows unauthenticated access', () => {
  // Should NOT redirect unauthenticated users to signin
  assert.doesNotMatch(subscriptionPage, /router\.push\('\/auth\/signin'\)/)
})

test('Subscription page has handleCheckout with unauthenticated redirect', () => {
  assert.match(subscriptionPage, /sessionStatus === 'unauthenticated'/)
  assert.match(subscriptionPage, /\/auth\/signup/)
  assert.match(subscriptionPage, /planName/)
})
