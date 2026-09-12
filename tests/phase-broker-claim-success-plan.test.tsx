import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { ClaimPlanExperience } from '../app/broker/subscription/plan/ClaimPlanExperience'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

const mockRouter = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  back: () => {},
  forward: () => {},
  prefetch: () => Promise.resolve(),
  fastRefresh: () => Promise.resolve(),
}

const render = (children: React.ReactNode) =>
  renderToStaticMarkup(<AppRouterContext.Provider value={mockRouter as never}>{children}</AppRouterContext.Provider>)

const freePlan = {
  id: 'plan-free',
  code: 'FREE',
  name: 'Free',
  description: 'Basic broker listing',
  price: 0,
  currency: 'usd',
  billingInterval: 'month',
  displayOrder: 10,
  stripePriceId: null,
  isActive: true,
  features: ['Local Broker Listing', 'Appear in Search Results'],
}

const featuredPlan = {
  id: 'plan-featured',
  code: 'FEATURED',
  name: 'Mortgage Expert',
  description: 'Get featured in listings and direct leads',
  price: 1500,
  currency: 'usd',
  billingInterval: 'month',
  displayOrder: 20,
  stripePriceId: 'price_featured_test',
  isActive: true,
  features: ['Appear Above Free Listings', 'Mortgage Expert Badge + 5 Green Stars'],
}

// ===========================================================================
// 1. Claim redirect target (the only post-claim destination change)
// ===========================================================================

test('claim complete route redirects to the claim plan page, not the dashboard', () => {
  const route = read('app/api/claims/session/complete/route.ts')
  assert.match(route, /redirectTo: '\/broker\/subscription\/plan'/, 'post-claim destination is the focused plan page')
  assert.doesNotMatch(route, /redirectTo: '\/broker\/dashboard'/, 'must no longer send claimed brokers to the dashboard')
})

test('claim transaction is untouched and email is dispatched after commit, fire-and-forget', () => {
  const route = read('app/api/claims/session/complete/route.ts')
  assert.match(route, /await completeClaimForUser\(context, session\.user\.id, session\.user\.email\)/)
  assert.match(route, /await clearClaimContext\(\)/)
  assert.match(route, /void sendAdminBrokerClaimedNotification\(completed\.brokerId\)/)
  assert.doesNotMatch(route, /await sendAdminBrokerClaimedNotification/, 'must never block the claim on email delivery')
  assert.ok(
    route.indexOf('completeClaimForUser(') < route.indexOf('sendAdminBrokerClaimedNotification('),
    'admin notification is dispatched AFTER claim completion',
  )
  // The claim transaction itself must remain unchanged.
  const completion = read('lib/claim-completion.ts')
  assert.match(completion, /broker\.updateMany\(\{ where: \{ id: currentInvitation\.claim\.brokerId, userId: null \}, data: \{ userId \} \}\)/)
  assert.doesNotMatch(completion, /sendAdminBrokerClaimedNotification|sendEmail/)
})

// ===========================================================================
// 2. Server plan page — authorization, server-side data, no client waterfall
// ===========================================================================

test('plan page is a server component using canonical broker auth and server-side plan data', () => {
  const page = read('app/broker/subscription/plan/page.tsx')
  assert.doesNotMatch(page, /'use client'/, 'page must be server-rendered')
  assert.match(page, /getCurrentUser\(\)/)
  assert.match(page, /redirect\('\/auth\/signin'\)/)
  assert.match(page, /roleHome\(user\.role\)/)
  assert.match(page, /isBrokerSetupComplete\(user\)/)
  assert.match(page, /listBrokerPlansPublic\(\)/)
  assert.match(page, /ClaimPlanExperience/)
  assert.doesNotMatch(page, /'use client'/)
  assert.doesNotMatch(page, /import[^\n]*useSWR/)
  assert.doesNotMatch(page, /await fetch\(/)
  assert.doesNotMatch(page, /useEffect\(/)
})

test('completed claimed brokers are not intercepted by the onboarding state machine', () => {
  const page = read('app/broker/subscription/plan/page.tsx')
  // The state machine is only consulted when the profile is NOT complete, and it
  // is invoked with this page as the current path.
  assert.match(
    page,
    /if \(!isBrokerSetupComplete\(user\)\) \{\s*const destination = resolveBrokerOnboardingDestination\(user, '\/broker\/subscription\/plan'\)/,
  )
})

test('plan page keeps /broker/subscription as the separate management page', () => {
  const overview = read('app/broker/subscription/page.tsx')
  assert.match(overview, /Subscription Management/, 'overview page purpose preserved')
  assert.match(overview, /SubscriptionPlans|SubscriptionPlan/, 'overview still owns plan management UI')
  assert.doesNotMatch(overview, /ClaimPlanExperience/, 'overview is not repurposed')
})

// ===========================================================================
// 3. Client experience — FREE current + Mortgage Expert + dashboard CTA
// ===========================================================================

test('CASE 1: FREE claimed broker renders Free as current, Mortgage Expert, and both CTAs', () => {
  const html = render(
    <ClaimPlanExperience brokerName="Acme Loans" currentPlan="FREE" plans={[freePlan, featuredPlan]} />,
  )
  assert.match(html, /Your broker profile is ready/)
  assert.match(html, /Current plan/)
  assert.match(html, /Mortgage Expert/)
  assert.match(html, /Upgrade to Mortgage Expert/)
  assert.match(html, /Go to Dashboard/)
  assert.match(html, /\/broker\/dashboard/)
  assert.doesNotMatch(html, /checkout\.stripe\.com/, 'no checkout session is created on render')
})

test('CASE 4: already-FEATURED broker shows Mortgage Expert as current and no upgrade CTA', () => {
  const html = render(
    <ClaimPlanExperience brokerName="Acme Loans" currentPlan="FEATURED" plans={[freePlan, featuredPlan]} />,
  )
  assert.match(html, /Current plan/)
  assert.match(html, /Go to Dashboard/)
  assert.doesNotMatch(html, /Upgrade to Mortgage Expert/, 'no second checkout is offered when already FEATURED')
})

test('upgrade uses the existing broker FEATURED checkout endpoint with the DB price', () => {
  const component = read('app/broker/subscription/plan/ClaimPlanExperience.tsx')
  assert.match(component, /fetch\('\/api\/subscription\/checkout'/)
  assert.match(component, /body: JSON\.stringify\(\{ priceId: featuredPlan\.stripePriceId, plan: 'FEATURED' \}\)/)
  assert.doesNotMatch(component, /\/api\/subscription\/upgrade/, 'FREE -> FEATURED must not use the paid upgrade endpoint')
  assert.doesNotMatch(component, /api\/broker\/claim\/checkout|api\/subscription\/plan\/checkout|new Stripe|stripe\.checkout/, 'no second checkout system')
})

test('Free is never routed through checkout', () => {
  const component = read('app/broker/subscription/plan/ClaimPlanExperience.tsx')
  // The only checkout call is guarded by the FEATURED plan price and never fires
  // for FREE. The dashboard CTA is a plain link, not a checkout call.
  assert.match(component, /if \(loading \|\| !featuredPlan\?\.stripePriceId\) return/)
  assert.match(component, /href="\/broker\/dashboard"/)
})

// ===========================================================================
// 4. Admin claim-success email — static wiring
// ===========================================================================

test('admin claim-success template exists, renders through the shared shell, and leaks no secrets', () => {
  const templates = read('lib/email-templates.ts')
  assert.match(templates, /AdminBrokerClaimedEmailData/)
  assert.match(templates, /adminBrokerClaimed: \(data: AdminBrokerClaimedEmailData\)/)
  const block = templates.slice(
    templates.indexOf('adminBrokerClaimed: ('),
    templates.indexOf('export function htmlToText'),
  )
  assert.match(block, /renderEmailShell\(/)
  assert.match(block, /status: \{ tone: 'success'/)
  assert.match(block, /'Claimed At': new Date\(data\.claimedAt\)\.toLocaleString\(\)/)
  for (const forbidden of ['token', 'password', 'secret', 'stripe', 'cvv', 'apiKey']) {
    assert.doesNotMatch(block, new RegExp(forbidden, 'i'), `adminBrokerClaimed must not reference ${forbidden}`)
  }
})

test('admin claim sender uses canonical admin recipients and a deterministic per-broker key', () => {
  const actions = read('actions/email.action.ts')
  const block = actions.slice(
    actions.indexOf('export async function sendAdminBrokerClaimedNotification'),
    actions.indexOf('export async function sendBrokerClaimInvitationEmail'),
  )
  assert.match(block, /platformConfig\.adminEmails\.length === 0/, 'empty ADMIN_EMAILS is a safe no-op')
  assert.match(block, /to: platformConfig\.adminEmails/, 'all configured admins receive the notification')
  assert.match(block, /idempotencyKey: `admin_broker_claimed_\$\{broker\.id\}`/, 'deterministic idempotency key')
  assert.doesNotMatch(block, /process\.env\.ADMIN_EMAIL/, 'recipients come only from platformConfig')
})

test('claim email failure cannot fail the claim (fire-and-forget + try/catch)', () => {
  const actions = read('actions/email.action.ts')
  const block = actions.slice(
    actions.indexOf('export async function sendAdminBrokerClaimedNotification'),
    actions.indexOf('export async function sendBrokerClaimInvitationEmail'),
  )
  assert.match(block, /catch \(error\)/)
  assert.match(block, /return \{ success: false, error:/)
})
