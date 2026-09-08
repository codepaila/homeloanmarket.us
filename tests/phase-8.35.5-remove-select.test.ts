import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const exists = (path: string) => fs.existsSync(path)

// ===========================================================================
// PHASE 8.35.5 — REMOVE /broker/subscription/select
//
// The legacy standalone broker-registration plan-select route is permanently
// removed. /setup (wizard Step 6) is the sole canonical new-broker plan-selection
// UI. These tests lock in the removal and the final routing architecture.
// ===========================================================================

test('8.35.5: the legacy /broker/subscription/select route file is deleted', () => {
  assert.equal(exists('app/broker/subscription/select/page.tsx'), false, 'route file must be removed')
  assert.equal(exists('app/broker/subscription/select'), false, 'route directory must be removed')
})

test('8.35.5: no production code references /broker/subscription/select', () => {
  const productionFiles = [
    'app/setup/page.tsx',
    'components/sections/broker/BrokerSetupWizard.tsx',
    'app/api/broker-registration/subscription/checkout/route.ts',
    'app/api/broker-registration/subscription/verify/route.ts',
    'app/broker-registration/subscription/success/page.tsx',
    'app/(public)/subscription/page.tsx',
    'lib/broker-onboarding-state.ts',
    'lib/broker-registration-verify.ts',
    'app/broker/subscription/page.tsx',
  ]
  for (const file of productionFiles) {
    assert.doesNotMatch(read(file), /broker\/subscription\/select/, `${file} must not reference the legacy route`)
  }
})

test('8.35.5: /setup?plan= remains the canonical new-broker plan handoff', () => {
  const setupPage = read('app/setup/page.tsx')
  const publicPage = read('app/(public)/subscription/page.tsx')
  assert.match(setupPage, /rawPlan === 'FREE' \|\| rawPlan === 'FEATURED' \? rawPlan : null/)
  assert.match(publicPage, /\/setup\?plan=\$\{code\}/)
  assert.doesNotMatch(publicPage, /\/broker\/subscription\/select\?plan=/)
})

test('8.35.5: Stripe FEATURED cancel and verification failure resolve to /setup', () => {
  assert.match(read('app/api/broker-registration/subscription/checkout/route.ts'), /cancel_url:.*\/setup/)
  const successPage = read('app/broker-registration/subscription/success/page.tsx')
  assert.match(successPage, /redirect\('\/setup'\)/)
  assert.doesNotMatch(successPage, /broker\/subscription\/select/)
  // Successful FEATURED return still finalizes → /broker/dashboard.
  assert.match(successPage, /finalizeBrokerRegistration\(user\.id\)/)
  assert.match(successPage, /redirect\('\/broker\/dashboard'\)/)
})

test('8.35.5: existing broker subscription management stays on /broker/subscription', () => {
  const publicPage = read('app/(public)/subscription/page.tsx')
  assert.match(publicPage, /role === 'BROKER' && hasBrokerProfile/)
  assert.match(publicPage, /'\/broker\/subscription'/)
  // The management page still exists.
  assert.equal(exists('app/broker/subscription/page.tsx'), true)
})

test('8.35.5: onboarding state machine routes pending/in-progress brokers to /setup only', () => {
  const state = read('lib/broker-onboarding-state.ts')
  assert.doesNotMatch(state, /\/broker\/subscription\/select/)
  assert.match(state, /return currentPath === '\/setup' \? null : '\/setup'/)
})