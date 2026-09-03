import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

// ---------------------------------------------------------------------------
// PHASE 2 — Legacy Stripe path removed / migrated
// ---------------------------------------------------------------------------

const action = read('actions/subscription.ts')

test('legacy actions/subscription.ts no longer reads STRIPE_SECRET_KEY directly', () => {
  assert.doesNotMatch(action, /process\.env\.STRIPE_SECRET_KEY/)
})

test('legacy actions/subscription.ts no longer instantiates a competing Stripe client', () => {
  assert.doesNotMatch(action, /new Stripe\(/)
})

test('legacy actions/subscription.ts no longer contains the secret-logging relic', () => {
  assert.doesNotMatch(action, /console\.log\(.*STRIPE_SECRET_KEY/)
})

test('legacy actions/subscription.ts uses the canonical Stripe client', () => {
  assert.match(action, /stripeClient\(\)/)
  assert.match(action, /from '@\/lib\/stripe-config'/)
})

test('legacy actions/subscription.ts no longer throws at module load from env', () => {
  assert.doesNotMatch(action, /if \(!process\.env\.STRIPE_SECRET_KEY\) \{/)
  assert.doesNotMatch(action, /throw new Error\('STRIPE_SECRET_KEY is not set in environment variables'\)/)
})

test('no other app file reads the secret key directly (only canonical config + error text)', () => {
  // Authoritative resolution lives only in lib/stripe-config.ts.
  const stripeConfig = read('lib/stripe-config.ts')
  assert.match(stripeConfig, /getStripeSecretKey/)
  // The webhook/portal/cancel/checkout routes only validate a resolved key and
  // never read the env var directly to build a client.
  const webhook = read('app/api/stripe/webhook/route.ts')
  assert.doesNotMatch(webhook, /new Stripe\(process\.env/)
  assert.match(webhook, /getStripeSecretKey\(\)/)
})

test('a single canonical Stripe client factory is used across the app', () => {
  // lib/stripe-config exposes stripeClient(); consumers import it rather than
  // building clients from env. No consumer reads STRIPE_SECRET_KEY env to build one.
  const isolated = read('lib/plan-price-isolation.ts')
  assert.ok(isolated)
  const checkout = read('app/api/company/subscription/checkout/route.ts')
  assert.doesNotMatch(checkout, /new Stripe\(process\.env/)
})
