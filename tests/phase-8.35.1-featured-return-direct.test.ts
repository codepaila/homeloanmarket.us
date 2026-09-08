import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const successPage = read('app/broker-registration/subscription/success/page.tsx')
const verifyLib = read('lib/broker-registration-verify.ts')
const verifyRoute = read('app/api/broker-registration/subscription/verify/route.ts')
const finalizeLib = read('lib/broker-registration.ts')
const webhook = read('app/api/stripe/webhook/route.ts')
const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')

// ===========================================================================
// PHASE 8.35.1 — ELIMINATE POST-CHECKOUT INTERMEDIATE PAGES
//
// After a successful FEATURED Stripe Checkout the user must go directly:
//   Stripe Checkout → authoritative verification → finalizeBrokerRegistration()
//   → /broker/dashboard
// with NO visible visit to /setup, Review, or "Complete Broker Profile".
// All verification/finalization authority stays server-side; the browser never
// provides Stripe price or ACTIVE-subscription state.
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. Successful return: server page verifies → finalizes → /broker/dashboard
// ---------------------------------------------------------------------------

test('8.35.1: the success page is a server component that finalizes and redirects to /broker/dashboard', () => {
  assert.match(successPage, /verifyBrokerRegistrationCheckout/)
  assert.match(successPage, /finalizeBrokerRegistration\(user\.id\)/)
  assert.match(successPage, /redirect\('\/broker\/dashboard'\)/)
})

test('8.35.1: the success page never redirects to /setup on a successful checkout', () => {
  // The success path (after finalize succeeds) goes straight to /broker/dashboard.
  // /setup is only ever used for failure/recovery branches (invalid session,
  // verification failure, incomplete profile).
  assert.match(successPage, /\}\s*\n\s*redirect\('\/broker\/dashboard'\)\s*\}/)
  // The success flow itself never targets /setup.
  const successFlow = successPage.slice(successPage.indexOf('redirect(\'/broker/dashboard\')'), successPage.length)
  assert.doesNotMatch(successFlow, /redirect\('\/setup'\)/)
})

test('8.35.1: cancelled/failed/unverified returns recover through /setup and never finalize', () => {
  // Failure/recovery branches (invalid/missing session, verification failure)
  // redirect to the canonical /setup flow; finalization is never reached.
  assert.match(successPage, /redirect\('\/setup'\)/)
  assert.doesNotMatch(successPage, /broker\/subscription\/select/)
  const beforeFinalize = successPage.slice(successPage.indexOf('const verified'), successPage.indexOf('await finalizeBrokerRegistration'))
  assert.match(beforeFinalize, /if \(!verified\.ok\)\s*\{[\s\S]*?redirect\('\/setup'\)/)
})

// ---------------------------------------------------------------------------
// 2. Verification authority (shared module) — never trusts the client
// ---------------------------------------------------------------------------

test('8.35.1: ownership mismatch is rejected (customer + user + registration)', () => {
  assert.match(verifyLib, /customerId !== local\?\.stripeCustomerId/)
  assert.match(verifyLib, /session\.metadata\?\.userId && session\.metadata\.userId !== user\.id/)
  assert.match(verifyLib, /session\.metadata\?\.brokerRegistrationId && session\.metadata\.brokerRegistrationId !== user\.brokerRegistration\.id/)
  assert.match(verifyLib, /Checkout session does not belong to this account/)
  assert.match(verifyLib, /Checkout session does not belong to this registration/)
})

test('8.35.1: non-paid / non-active subscription is rejected (no finalization)', () => {
  assert.match(verifyLib, /session\.status !== 'complete' \|\| session\.payment_status !== 'paid'/)
  assert.match(verifyLib, /typeof session\.subscription !== 'string'/)
  assert.match(verifyLib, /!\[\s*'active',\s*'trialing'\s*\]\.includes\(stripeSubscription\.status\)/)
})

test('8.35.1: verification synchronizes via the canonical registration-subscription service', () => {
  assert.match(verifyLib, /SubscriptionService\.updateRegistrationSubscriptionFromStripe/)
  // The API verify route is a thin JSON wrapper keeping the /setup fallback.
  assert.match(verifyRoute, /verifyBrokerRegistrationCheckout/)
  assert.match(verifyRoute, /redirectTo: '\/setup'/)
})

// ---------------------------------------------------------------------------
// 3. Idempotency — no duplicate Broker/Subscription
// ---------------------------------------------------------------------------

test('8.35.1: finalizeBrokerRegistration is idempotent (returns existing broker)', () => {
  assert.match(finalizeLib, /const existing = await tx\.broker\.findFirst/)
  assert.match(finalizeLib, /if \(existing\) \{\s*return existing\s*\}/)
})

test('8.35.1: the webhook never finalizes (return-first then webhook cannot duplicate)', () => {
  assert.doesNotMatch(webhook, /finalizeBrokerRegistration/)
  assert.doesNotMatch(webhook, /createBrokerForExistingUser/)
  // The webhook only synchronizes the registration subscription (idempotent).
  assert.match(webhook, /updateSubscriptionFromStripe/)
})

test('8.35.1: refreshing the Stripe success URL is safe (idempotent finalization + dashboard)', () => {
  // Re-running the page re-verifies (idempotent sync) and finalizeBrokerRegistration
  // returns the existing Broker — no duplicate Broker, no error on already-finalized.
  assert.match(successPage, /finalizeBrokerRegistration\(user\.id\)/)
  assert.match(finalizeLib, /if \(existing\) \{\s*return existing\s*\}/)
  assert.match(successPage, /redirect\('\/broker\/dashboard'\)/)
})

// ---------------------------------------------------------------------------
// 4. No /setup hop and no unnecessary return-page data fetching
// ---------------------------------------------------------------------------

test('8.35.1: the return page performs no /setup navigation and no plan fetch', () => {
  assert.doesNotMatch(successPage, /router\.replace\('\/setup'\)/)
  assert.doesNotMatch(successPage, /api\/subscription\/plans/)
  assert.doesNotMatch(successPage, /useSession\(\)/)
  assert.doesNotMatch(successPage, /'use client'/)
})

// ---------------------------------------------------------------------------
// 5. Recovery through /setup remains (Phase 8.35 auto-finalization kept)
// ---------------------------------------------------------------------------

test('8.35.1: Phase 8.35 setup auto-finalization remains as the recovery path', () => {
  assert.match(wizard, /const autoFinalizeAttemptedRef = useRef\(false\)/)
  assert.match(wizard, /void onSubmit\(\)/)
  assert.match(wizard, /if \(subscription\?\.isActive && subscription\?\.status === 'ACTIVE' && persisted >= 5\)/)
})

test('8.35.1: Phase 8.32 FREE flow remains intact', () => {
  assert.match(wizard, /freeActivatedOverrideRef = useRef\(false\)/)
  assert.match(wizard, /freeActivatedOverrideRef\.current\s*=\s*true/)
  assert.match(wizard, /await onFinalize\(\)/)
})