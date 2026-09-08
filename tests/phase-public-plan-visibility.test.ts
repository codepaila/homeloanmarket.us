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

test('Broker subscription page relies on the server-protected boundary for auth', () => {
  // /broker/* is proxy-protected for BROKER role, so the page carries no client
  // unauthenticated branch; checkout auth is enforced server-side by the route.
  assert.doesNotMatch(subscriptionPage, /sessionStatus === 'unauthenticated'/)
  assert.doesNotMatch(subscriptionPage, /useSession\(\)/)
  assert.match(subscriptionPage, /\/api\/subscription\/checkout/)
  assert.match(subscriptionPage, /planName/)
})
