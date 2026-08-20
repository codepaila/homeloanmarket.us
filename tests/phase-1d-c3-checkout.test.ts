import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { stripePriceIds, validatePlanPrice } from '../lib/stripe'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

test('Phase 1D C3: alternate profile edit page passes an explicit safe DTO', () => {
  const source = read('app/broker/profile/edit/page.tsx')
  assert.ok(source.includes('const profileUser ='), 'profile edit must construct a safe DTO')
  assert.ok(source.includes('<EditPersonalProfile user={profileUser} />'), 'client component must receive the safe DTO')
  assert.equal(source.includes('<EditPersonalProfile user={user} />'), false, 'full current user must not cross the client boundary')
  for (const field of ['accounts', 'contactMessages', 'password', 'access_token', 'refresh_token', 'id_token']) {
    assert.equal(source.includes(field), false, `${field} must not be referenced in the client-bound page`)
  }
})

test('Phase 1D C3: generic current-user loader excludes private relations and credentials', () => {
  const source = read('lib/currentUser.ts')
  assert.equal(source.includes('accounts: true'), false)
  assert.equal(/contactMessages\s*:/.test(source), false)
  assert.equal(source.includes('access_token'), false)
  assert.equal(source.includes('refresh_token'), false)
  assert.equal(source.includes('id_token'), false)
  assert.ok(source.includes('Deliberately EXCLUDES'))
})

test('Phase 1D checkout: public pricing UI sends the selected plan with its price', () => {
  const source = read('app/(public)/subscription/page.tsx')
  assert.ok(source.includes('body: JSON.stringify({ priceId, plan: planName })'))
  assert.ok(source.includes("fetch('/api/subscription/checkout'"))
})

test('Phase 1D checkout: server plan-price mapping remains authoritative', () => {
  const source = read('app/api/subscription/checkout/route.ts')
  assert.ok(source.includes('const { priceId, plan } = await request.json()'))
  // Checkout validates the plan against the DB-backed dynamic plan system.
  assert.ok(source.includes('validateBrokerPlanForCheckout'))
  assert.equal(validatePlanPrice('FEATURED', 'tampered-price'), null)
  assert.equal(validatePlanPrice('FEATURED', stripePriceIds.FEATURED)?.name, 'FEATURED')
  assert.equal(validatePlanPrice('FREE', ''), null)
})

test('Phase 1D checkout: API returns the URL shape consumed by the pricing UI', () => {
  const apiSource = read('app/api/subscription/checkout/route.ts')
  const uiSource = read('app/(public)/subscription/page.tsx')
  assert.ok(apiSource.includes('success: true'))
  assert.ok(apiSource.includes('url: checkoutSession.url'))
  assert.ok(uiSource.includes('if (data.url)'))
  assert.ok(uiSource.includes('window.location.href = data.url'))
})
