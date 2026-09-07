import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { brokerPlanDisplayName, isPaidBrokerPlan } from '../lib/broker-plan-display'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const esc = (token: string) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ===========================================================================
// 8.27.2 — BROKER LIVE SUBSCRIPTION BADGE SYNC
//
// The dashboard header badge and every broker-facing plan display must reflect
// the authoritative broker subscription (effectiveSubscription → getCurrentUser
// → subscriptionPlan / owner DTO subscription) and update immediately after a
// confirmed plan change — without a manual browser refresh. No second
// subscription state, no localStorage plan, no optimistic paid badge before the
// server confirms activation, no session-derived override.
// ===========================================================================

const BROKER_ME_KEY = `${'http://localhost:3000'}/api/brokers/me`

// ---------------------------------------------------------------------------
// 1. DISPLAY NAMES (FREE → Free, FEATURED → Mortgage Expert)
// ---------------------------------------------------------------------------

test('canonical plan display: FREE renders "Free" and FEATURED renders "Mortgage Expert"', () => {
  assert.equal(brokerPlanDisplayName('FREE'), 'Free')
  assert.equal(brokerPlanDisplayName('FEATURED'), 'Mortgage Expert')
  assert.equal(brokerPlanDisplayName(undefined), 'Free')
  assert.equal(brokerPlanDisplayName(''), 'Free')
  assert.equal(isPaidBrokerPlan('FEATURED'), true)
  assert.equal(isPaidBrokerPlan('FREE'), false)
})

test('header SubscriptionBadge renders only the canonical display name, never the raw plan code', () => {
  const badge = read('components/layout/admin/SubscriptionBadge.tsx')
  assert.match(badge, /brokerPlanDisplayName/)
  assert.doesNotMatch(badge, /isPremiumBroker/)
  assert.doesNotMatch(badge, /featuredListing/)
  assert.doesNotMatch(badge, /\{\s*user\.subscriptionPlan\s*\}/)
  assert.match(badge, /const planLabel = brokerPlanDisplayName\(planCode\)/)
  assert.match(badge, /const planCode = user\.subscriptionPlan/)
})

// ---------------------------------------------------------------------------
// 2. UPGRADE — authoritative confirmation → live badge update
// ---------------------------------------------------------------------------

test('successful upgrade re-syncs the chrome only after the server confirms the paid state', () => {
  const success = read('app/broker/subscription/success/page.tsx')
  const verify = read('app/api/subscription/verify/route.ts')
  // Verify reconciles the database from Stripe BEFORE reporting success.
  assert.ok(verify.indexOf('updateSubscriptionFromStripe') < verify.indexOf('success: true'))
  // The client re-syncs the layout/chrome in the success branch only.
  assert.equal((success.match(/resync\(\)/g) || []).length, 1)
  const successBranch = success.slice(success.indexOf('if (data.success)'), success.indexOf('} else {'))
  assert.match(successBranch, /resync\(\)/)
  assert.doesNotMatch(successBranch, /optimistic|setSubscriptionData/)
})

test('failed upgrade does not change the badge', () => {
  const success = read('app/broker/subscription/success/page.tsx')
  const failureBranches =
    success.slice(success.indexOf('} else {'), success.indexOf('useEffect')) +
    success.slice(success.indexOf('} catch (error) {'), success.length)
  assert.doesNotMatch(failureBranches, /resync\(\)/)
  // The checkout action only redirects to Stripe; no client-side plan state is
  // written before activation.
  const page = read('app/broker/subscription/page.tsx')
  assert.match(page, /window\.location\.href = data\.url/)
})

test('Stripe checkout never shows the paid badge before authoritative activation', () => {
  const page = read('app/broker/subscription/page.tsx')
  const plans = read('components/sections/subscriptions/SubscriptionPlan.tsx')
  // Selection opens checkout (redirect) — no setState of a paid plan.
  assert.doesNotMatch(page, /setSubscriptionData\([^)]*FEATURED/)
  assert.doesNotMatch(plans, /onSelectPlan.*setPlanCode/)
})

// ---------------------------------------------------------------------------
// 3. DOWNGRADE — portal return → authoritative fetch → live badge update
// ---------------------------------------------------------------------------

test('downgrade/portal return re-fetches authoritative state and re-syncs the chrome', () => {
  const page = read('app/broker/subscription/page.tsx')
  assert.match(page, /fetch\('\/api\/subscription\/usage'\)/)
  assert.match(page, /fetch\(detailsKey\)/)
  assert.equal((page.match(/resync\(\)/g) || []).length, 1)
  const successBranch = page.slice(page.indexOf('if (subscriptionJson.success)'), page.indexOf('} finally {'))
  assert.match(successBranch, /resync\(\)/)
  // Change is detected against the previously confirmed plan so the header and
  // subscription page cannot disagree, and a Free-downgrade toast is shown.
  assert.match(page, /'Your subscription has been changed to Free\.'/)
})

test('failed downgrade does not change the badge', () => {
  const page = read('app/broker/subscription/page.tsx')
  const failureBranch = page.slice(page.indexOf('} catch (error) {'), page.indexOf('} finally {'))
  assert.doesNotMatch(failureBranch, /resync\(\)/)
  assert.match(failureBranch, /toast\.error\('Failed to load subscription data'\)/)
})

// ---------------------------------------------------------------------------
// 4. LIVE STATE MECHANISM (router.refresh + SWR revalidation)
// ---------------------------------------------------------------------------

test('live update uses router.refresh + SWR revalidation: no new state system, no localStorage', () => {
  const hook = read('hooks/useSubscription.ts')
  assert.match(hook, /router\.refresh\(\)/)
  assert.match(hook, /mutate\(`\$\{baseUrl\}\/api\/brokers\/me`/)
  assert.match(hook, /mutate\(`\$\{baseUrl\}\/api\/subscription\/details`/)
  const success = read('app/broker/subscription/success/page.tsx')
  const page = read('app/broker/subscription/page.tsx')
  assert.match(success, /useBrokerChromeResync\(\)/)
  assert.match(page, /useBrokerChromeResync\(\)/)
  assert.doesNotMatch(hook + success + page, /localStorage/)
  assert.doesNotMatch(hook + success + page, /sessionStorage/)
  assert.doesNotMatch(hook + success + page, /createContext.*[Ss]ubscription|Provider value=.*plan/)
})

// ---------------------------------------------------------------------------
// 5. DOUBLE-SUBMIT PROTECTION / LOADING
// ---------------------------------------------------------------------------

test('duplicate subscription actions are prevented', () => {
  const plans = read('components/sections/subscriptions/SubscriptionPlan.tsx')
  assert.match(plans, /pendingCode/)
  assert.match(plans, /disabled=\{\(!plan\.stripePriceId && !isFree\) \|\| isPending\}/)
  const page = read('app/broker/subscription/page.tsx')
  assert.match(page, /disabled=\{portalLoading \|\| !subscriptionData\?\.stripeCustomerId\}/)
  const success = read('app/broker/subscription/success/page.tsx')
  assert.match(success, /verifyingRef\.current/)
  const select = read('app/broker/subscription/select/page.tsx')
  assert.match(select, /setLoading\('FREE'\)/)
})

// ---------------------------------------------------------------------------
// 6. SINGLE AUTHORITATIVE SOURCE (no enhancedUser / session override)
// ---------------------------------------------------------------------------

test('header derives its plan from the server-backed getUserTop and never the session', () => {
  const layout = read('app/broker/layout.tsx')
  assert.match(layout, /getCurrentUser\(\)/)
  const client = read('components/layout/admin/BrokerLayoutClient.tsx')
  // The server-side DB user (authoritative) wins over the JWT session fallback.
  assert.match(client, /const sidebarData = user \? buildServerSidebarData\(user\) : fallbackData/)
  assert.match(client, /user={sidebarData\.user}/)
})

test('no stale enhancedUser value overrides the authoritative subscription in the badge', () => {
  const badge = read('components/layout/admin/SubscriptionBadge.tsx')
  assert.equal((badge.match(/subscriptionPlan/g) || []).length, 1)
  assert.doesNotMatch(badge, /brokerProfile\?\.subscription/)
})

test('JWT subscription claims are re-derived from the database server-side on every refresh', () => {
  const authConfig = read('lib/auth.config.ts')
  const jwtBlock = authConfig.slice(authConfig.indexOf('async jwt('), authConfig.indexOf('async session('))
  assert.match(jwtBlock, /token\.brokerProfile = null/)
  assert.match(jwtBlock, /const subscription = dbUser\.brokerProfile\[0\]\.subscription/)
  assert.match(jwtBlock, /plan: subscription\.plan/)
})

// ---------------------------------------------------------------------------
// 7. DASHBOARD + SUBSCRIPTION PAGE AGREE
// ---------------------------------------------------------------------------

test('dashboard and subscription page display the same effective plan labels', () => {
  const dashboard = read('components/sections/broker/BrokerDashboard.tsx')
  const dashboardConfig = dashboard.slice(dashboard.indexOf('const planConfig'), dashboard.indexOf('const plan ='))
  assert.match(dashboardConfig, /FREE: \{ label: 'Free'/)
  assert.match(dashboardConfig, /FEATURED: \{ label: "Mortgage Expert"/)
  const profile = read('components/sections/broker/BrokerProfile.tsx')
  assert.match(profile, /FREE: \{ label: 'Free'/)
  assert.match(profile, /FEATURED: \{ label: "Mortgage Expert"/)
  assert.match(profile, /brokerPlanDisplayName\(subscription\?\.plan\)/)
  // Subscription page resolves the current plan from /api/subscription/details
  // (effective subscription) and names from /api/subscription/plans (DB plan).
  const page = read('app/broker/subscription/page.tsx')
  assert.match(page, /const currentPlan = subscriptionData\?\.plan \|\| 'FREE'/)
  assert.match(page, /availablePlans\.find\(\(p: any\) => p\.code === currentPlan\)/)
})

test('BrokerDashboard and header both derive the plan from subscription data, with no fake metrics', () => {
  const dashboard = read('components/sections/broker/BrokerDashboard.tsx')
  assert.match(dashboard, /currentBroker\?\.subscription\?\.isActive && currentBroker\.subscription\.plan !== 'FREE'/)
  for (const metric of ['successRate', 'responseRate', 'avgProcessingTime', 'totalLoansProcessed', 'bankPartners', 'contactMessages']) {
    assert.doesNotMatch(dashboard, new RegExp(esc(metric)), `dashboard must not render ${metric}`)
  }
})

// ---------------------------------------------------------------------------
// 8. CONTACT MESSAGES / BANK PARTNERS ABSENT FROM SUBSCRIPTION SURFACE
// ---------------------------------------------------------------------------

test('subscription tabs render no Contact Messages or Bank Partners', () => {
  const stats = read('components/sections/subscriptions/Usagestats.tsx')
  const page = read('app/broker/subscription/page.tsx')
  for (const file of [stats, page]) {
    for (const token of ['Bank Partners', 'Contact Messages', 'bankPartners', 'contactMessages']) {
      assert.doesNotMatch(file, new RegExp(esc(token)), `subscription surface must not render ${token}`)
    }
  }
})

test('no unnecessary contact-message or bank-partner fetch for subscription UI', () => {
  const route = read('app/api/subscription/usage/route.ts')
  assert.doesNotMatch(route, /bankPartners:\s*true/)
  assert.doesNotMatch(route, /contactMessages:\s*\{/)
  assert.doesNotMatch(route, /broker\.bankPartners/)
  assert.doesNotMatch(route, /broker\.contactMessages/)
  const lib = read('lib/subscription.ts')
  const statsBlock = lib.slice(lib.indexOf('static async getUsageStats'), lib.indexOf('static async canUpgrade'))
  assert.doesNotMatch(statsBlock, /bankPartners:\s*true/)
  assert.doesNotMatch(statsBlock, /contactMessages:\s*\{/)
})

// ---------------------------------------------------------------------------
// 9. AUTHORITATIVE SUBSCRIPTION SOURCE IS PRESERVED (architecture unchanged)
// ---------------------------------------------------------------------------

test('subscription architecture and webhook authority are untouched', () => {
  const lib = read('lib/subscription.ts')
  assert.match(lib, /effectiveSubscription\(/)
  assert.match(lib, /updateSubscriptionFromStripe/)
  const webhook = read('app/api/stripe/webhook/route.ts')
  assert.match(webhook, /checkout\.session\.completed/)
  assert.match(webhook, /customer\.subscription\.updated/)
  assert.doesNotMatch(read('prisma/schema.prisma'), /model BrokerSubscription2|model LivePlan2/)
})