import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const page = read('app/broker/subscription/page.tsx')

// ===========================================================================
// PHASE 8.34 — /broker/subscription PAGE PERFORMANCE
//
// Confirmed redundant work on /broker/subscription before this phase:
//   1. A full-page `loading || sessionStatus === 'loading'` spinner blocked the
//      ENTIRE page (including the Plans tab, which only needs /api/subscription/plans)
//      until the details + usage manual fetch resolved — a redundant loading
//      boundary when the page can render from server-known state + fallbacks.
//   2. `resync()` (router.refresh + 3 SWR revalidations of details/usage/brokers-me)
//      fired on EVERY page load after the initial details fetch, re-issuing the
//      same requests it had just completed and triggering a full RSC re-render
//      for no state change.
// ===========================================================================

test('8.34: no full-page loading spinner blocks the subscription page render', () => {
  // The page no longer early-returns a whole-page spinner while subscription
  // details load; it renders immediately and shows an inline loading note.
  assert.doesNotMatch(page, /if \(loading \|\| sessionStatus === 'loading'\)\s*\{\s*return/)
  assert.doesNotMatch(page, /Loading subscription information\.\.\.\s*<\/p>\s*<\/div>\s*<\/div>\s*\)\s*\}/)
  // The page still renders the loading note inline (scoped to the overview card).
  assert.match(page, /Loading subscription information\.\.\./)
})

test('8.34: the page renders plans/current subscription from fallbacks while details load', () => {
  // currentPlan/status derive from loaded data with safe defaults, so the page
  // can render before the details request resolves.
  assert.match(page, /const currentPlan = subscriptionData\?\.plan \|\| 'FREE'/)
  assert.match(page, /subscriptionData\?\.status \|\| 'INACTIVE'/)
})

test('8.34: resync() is issued only when the plan actually changed (portal return)', () => {
  // Exactly one resync() call site, guarded by a plan-change comparison — no
  // redundant chrome re-sync + router.refresh on an ordinary page load.
  assert.equal((page.match(/resync\(\)/g) || []).length, 1)
  assert.match(page, /if \(planChanged\) resync\(\)/)
  assert.match(page, /const planChanged = Boolean\(previousPlan && nextPlan && previousPlan !== nextPlan\)/)
})

test('8.34: initial page load no longer triggers a redundant router.refresh/resync', () => {
  // The success branch of the details fetch only re-syncs the chrome when the
  // subscription changed (portal return); an unchanged load keeps the already
  // server-rendered badge and skips the duplicate details/usage/brokers-me calls.
  const successBranch = page.slice(page.indexOf('if (subscriptionJson.success)'), page.indexOf('} finally {'))
  assert.match(successBranch, /if \(planChanged\) resync\(\)/)
  assert.match(successBranch, /setSubscriptionData\(subscriptionJson\.data\)/)
})

test('8.34: plan cards remain selectable and the CTA stays type="button"', () => {
  const planCard = read('components/sections/subscriptions/SubscriptionPlan.tsx')
  assert.doesNotMatch(planCard, /type="submit"/)
  const pricingCard = read('components/design/PricingCard.tsx')
  assert.match(pricingCard, /<motion\.button[\s\S]*?type="button"/)
})

// ---------------------------------------------------------------------------
// PHASE 8.34.1 — USAGE IS NO LONGER PART OF THE BROKER SUBSCRIPTION PRODUCT
// ---------------------------------------------------------------------------

test('8.34.1: the page no longer fetches /api/subscription/usage', () => {
  assert.doesNotMatch(page, /fetch\('\/api\/subscription\/usage'\)/)
})

test('8.34.1: UsageStats, usageData, Quick Stats and the Usage tab are removed', () => {
  assert.doesNotMatch(page, /UsageStats/)
  assert.doesNotMatch(page, /usageData/)
  assert.doesNotMatch(page, /Profile Views/)
  assert.doesNotMatch(page, /TabsTrigger value="usage"/)
  assert.doesNotMatch(page, /TabsContent value="usage"/)
  // No dead usage imports/icons remain.
  assert.doesNotMatch(page, /TrendingUp/)
  assert.doesNotMatch(page, /Eye/)
})

test('8.34.1: the page keeps exactly Subscription, Plans & Pricing, and Billing', () => {
  assert.match(page, /TabsTrigger value="overview"/)
  assert.match(page, /TabsTrigger value="plans"/)
  assert.match(page, /TabsTrigger value="billing"/)
  assert.match(page, /<BillingHistory \/>/)
  // Plan source stays canonical (SWR /api/subscription/plans).
  assert.match(page, /useSubscriptionPlans\(\)/)
})

test('8.34.1: no client-side session dependency remains (server-protected page)', () => {
  assert.doesNotMatch(page, /useSession\(\)/)
  assert.doesNotMatch(page, /sessionStatus/)
})

test('8.34.1: checkout/portal handlers remain intact and authoritative', () => {
  assert.match(page, /fetch\('\/api\/subscription\/checkout'/)
  assert.match(page, /fetch\('\/api\/subscription\/portal'/)
  assert.match(page, /window\.location\.href = data\.url/)
  // The page never finalizes a broker or treats checkout as activation.
  assert.doesNotMatch(page, /finalizeBrokerRegistration/)
  assert.doesNotMatch(page, /\/api\/brokers/)
  assert.doesNotMatch(page, /status === 'ACTIVE'/)
})