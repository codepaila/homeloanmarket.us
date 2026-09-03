import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ===========================================================================
// BROKER SUBSCRIPTION PLANS VISIBILITY TESTS
// ===========================================================================

test('Broker admin GET API returns plans array', () => {
  const api = read('app/api/admin/broker-plans/route.ts')
  assert.match(api, /return NextResponse\.json\(\s*\{\s*plans:/);
  assert.match(api, /plans: plans\.map/);
})

test('Broker admin GET API returns supportedPlans with exists flag', () => {
  const api = read('app/api/admin/broker-plans/route.ts')
  assert.match(api, /supportedPlans.*exists:.*existingCodes\.has/);
})

test('Broker admin list page queries ALL plans without isActive filter', () => {
  const page = read('app/admin/billing/broker-plans/page.tsx')
  assert.match(page, /brokerSubscriptionPlan\.findMany\(\s*\{/)
  assert.match(page, /include:\s*\{\s*features:\s*true/)
  // Should NOT have where: { isActive: true } for the main query
  const planQuerySection = page.match(/brokerSubscriptionPlan\.findMany\(\s*\{[^}]*\}\s*\)/)[0]
  assert.doesNotMatch(planQuerySection, /where:\s*\{\s*isActive:\s*true\s*\}/)
})

test('Broker admin list page displays inactive plans', () => {
  const page = read('app/admin/billing/broker-plans/page.tsx')
  assert.match(page, /plan\.isActive.*Active.*Inactive/)
  assert.match(page, /plans\.map/)
})

test('Broker admin create form fetches supportedPlans from API', () => {
  const form = read('app/admin/billing/broker-plans/new/page.tsx')
  assert.match(form, /fetch\('\/api\/admin\/broker-plans'\)/)
  assert.match(form, /data\.supportedPlans/)
  assert.match(form, /setSupportedPlans\(data\.supportedPlans/)
})

test('Broker admin create form shows all plans with availability state', () => {
  const form = read('app/admin/billing/broker-plans/new/page.tsx')
  assert.match(form, /supportedPlans\.filter\(\(p\)\s*=>\s*!p\.exists/)
  assert.match(form, /supportedPlans\.filter\(\(p\)\s*=>\s*p\.exists/)
  assert.match(form, /Already configured/)
  assert.match(form, /Available/)
})

test('Broker admin edit form fetches plan by ID from API', () => {
  const form = read('app/admin/billing/broker-plans/[id]/page.tsx')
  assert.match(form, /fetch\(`\/api\/admin\/broker-plans\/\$\{planId\}`\)/)
})

test('Broker admin GET [id] API returns displayName', () => {
  const api = read('app/api/admin/broker-plans/[id]/route.ts')
  assert.match(api, /displayName:\s*getBrokerPlanDisplayName/)
})

// ===========================================================================
// COMPANY ADVERTISING PLANS VISIBILITY TESTS
// ===========================================================================

test('Company admin GET API returns plans array', () => {
  const api = read('app/api/admin/company-advertising-plans/route.ts')
  assert.match(api, /return NextResponse\.json\(\s*\{\s*plans:/)
})

test('Company admin list page queries ALL plans without isActive filter', () => {
  const page = read('app/admin/billing/company-advertising-plans/page.tsx')
  assert.match(page, /companyAdvertisingPlan\.findMany\(\s*\{/)
  // Should NOT have where: { isActive: true } for the main query
  const planQuerySection = page.match(/companyAdvertisingPlan\.findMany\(\s*\{[^}]*\}\s*\)/)[0]
  assert.doesNotMatch(planQuerySection, /where:\s*\{\s*isActive:\s*true\s*\}/)
})

test('Company admin list page displays all plans including inactive', () => {
  const page = read('app/admin/billing/company-advertising-plans/page.tsx')
  assert.match(page, /plans\.map/)
  assert.match(page, /plan\.isActive/)
})

test('Company admin edit form fetches plan by ID', () => {
  const form = read('app/admin/billing/company-advertising-plans/[id]/page.tsx')
  assert.match(form, /fetch\(`\/api\/admin\/company-advertising-plans\/\$\{id\}`\)/)
})

// ===========================================================================
// DUPLICATE DETECTION
// ===========================================================================

test('Broker create API returns 409 on duplicate plan code', () => {
  const api = read('app/api/admin/broker-plans/route.ts')
  assert.match(api, /A plan with this code already exists/)
  assert.match(api, /status: 409/)
})

test('Company create API returns 409 on duplicate plan name', () => {
  const api = read('app/api/admin/company-advertising-plans/route.ts')
  assert.match(api, /A plan with this name already exists/)
  assert.match(api, /status: 409/)
})

// ===========================================================================
// REGRESSION TESTS
// ===========================================================================

test('Public broker plans API uses public flow not admin API', () => {
  const publicApi = read('app/api/subscription/plans/route.ts')
  assert.match(publicApi, /listBrokerPlansPublic/)
  assert.doesNotMatch(publicApi, /getCurrentUser/)
})

test('Broker authorization preserved for admin routes', () => {
  const api = read('app/api/admin/broker-plans/route.ts')
  assert.match(api, /getAdminUser/)
  assert.match(api, /Forbidden/)
})

