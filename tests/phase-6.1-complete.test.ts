import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ===========================================================================
// PHASE 6.1 COMPLETE VISIBILITY TEST SUITE
// ===========================================================================

// BROKER ADMIN LIST PAGE TESTS
test('Broker list: server component queries ALL plans without filters', () => {
  const page = read('app/admin/billing/broker-plans/page.tsx')
  assert.match(page, /export default async function.*BrokerPlansPage/)
  assert.match(page, /force-dynamic/)
  assert.match(page, /brokerSubscriptionPlan\.findMany/)
  assert.match(page, /orderBy/)
})

test('Broker list: renders all plans including inactive', () => {
  const page = read('app/admin/billing/broker-plans/page.tsx')
  assert.match(page, /plans\.map\(\(plan\)/)
  assert.match(page, /\{plans\.length === 0.*No plans/)
})

test('Broker list: shows active/inactive status for each plan', () => {
  const page = read('app/admin/billing/broker-plans/page.tsx')
  assert.match(page, /plan\.isActive.*Active.*Inactive/)
})

// BROKER ADMIN CREATE FORM TESTS
test('Broker create: client component fetches current plans on mount', () => {
  const form = read('app/admin/billing/broker-plans/new/page.tsx')
  assert.match(form, /useEffect\(\(\)/)
  assert.match(form, /fetch\('\/api\/admin\/broker-plans'\)/)
})

test('Broker create: shows loading state while fetching plans', () => {
  const form = read('app/admin/billing/broker-plans/new/page.tsx')
  assert.match(form, /loadingPlans.*Loading available plans/)
})

test('Broker create: shows error state if fetch fails', () => {
  const form = read('app/admin/billing/broker-plans/new/page.tsx')
  assert.match(form, /plansError.*Unable to load plan options/)
})

test('Broker create: displays existing plans with "Already configured" label', () => {
  const form = read('app/admin/billing/broker-plans/new/page.tsx')
  assert.match(form, /createdChoices.*Already configured/)
})

test('Broker create: displays available plans with "Available" label', () => {
  const form = read('app/admin/billing/broker-plans/new/page.tsx')
  assert.match(form, /availableChoices.*Available/)
})

test('Broker create: prevents form display if all plans exist', () => {
  const form = read('app/admin/billing/broker-plans/new/page.tsx')
  assert.match(form, /availableChoices\.length === 0.*All supported broker plans are already configured/)
})

// BROKER ADMIN GET API TESTS
test('Broker API GET: returns plans array at root level', () => {
  const api = read('app/api/admin/broker-plans/route.ts')
  assert.match(api, /return NextResponse\.json\(\s*\{\s*plans:/)
})

test('Broker API GET: returns supportedPlans array with exists flag', () => {
  const api = read('app/api/admin/broker-plans/route.ts')
  assert.match(api, /supportedPlans/)
  assert.match(api, /exists:.*existingCodes\.has/)
})

test('Broker API GET: includes plan features for each plan', () => {
  const api = read('app/api/admin/broker-plans/route.ts')
  assert.match(api, /include.*features/)
})

test('Broker API GET: requires admin authorization', () => {
  const api = read('app/api/admin/broker-plans/route.ts')
  assert.match(api, /getAdminUser/)
  assert.match(api, /Forbidden/)
})

// BROKER ADMIN CREATE API TESTS
test('Broker API POST: rejects duplicate plan codes with 409', () => {
  const api = read('app/api/admin/broker-plans/route.ts')
  assert.match(api, /A plan with this code already exists/)
  assert.match(api, /status: 409/)
})

test('Broker API POST: validates plan code is from fixed set', () => {
  const api = read('app/api/admin/broker-plans/route.ts')
  assert.match(api, /isSupportedBrokerPlanCode/)
})

// COMPANY ADMIN LIST PAGE TESTS
test('Company list: server component queries ALL plans', () => {
  const page = read('app/admin/billing/company-advertising-plans/page.tsx')
  assert.match(page, /export default async function.*CompanyAdvertisingPlansPage/)
  assert.match(page, /force-dynamic/)
  assert.match(page, /companyAdvertisingPlan\.findMany/)
})

test('Company list: renders all plans including inactive', () => {
  const page = read('app/admin/billing/company-advertising-plans/page.tsx')
  assert.match(page, /plans\.map\(\(plan/)
})

// COMPANY ADMIN GET API TESTS
test('Company API GET: returns plans array at root level', () => {
  const api = read('app/api/admin/company-advertising-plans/route.ts')
  assert.match(api, /return NextResponse\.json\(\s*\{\s*plans:/)
})

test('Company API GET: requires admin authorization', () => {
  const api = read('app/api/admin/company-advertising-plans/route.ts')
  assert.match(api, /user\.role !== 'ADMIN'/)
})

// COMPANY ADMIN CREATE API TESTS
test('Company API POST: rejects duplicate plan names with 409', () => {
  const api = read('app/api/admin/company-advertising-plans/route.ts')
  assert.match(api, /A plan with this name already exists/)
  assert.match(api, /status: 409/)
})

// REGRESSION TESTS
test('Public broker plans API is separate from admin API', () => {
  const publicApi = read('app/api/subscription/plans/route.ts')
  assert.doesNotMatch(publicApi, /getAdminUser/)
  assert.match(publicApi, /listBrokerPlansPublic/)
})

test('Broker edit page fetches by ID and displays stored values', () => {
  const edit = read('app/admin/billing/broker-plans/[id]/page.tsx')
  assert.match(edit, /fetch\(`\/api\/admin\/broker-plans\/\$\{planId\}`\)/)
  assert.match(edit, /data\.plan/)
})

test('Company edit page fetches by ID', () => {
  const edit = read('app/admin/billing/company-advertising-plans/[id]/page.tsx')
  assert.match(edit, /fetch\(`\/api\/admin\/company-advertising-plans\/\$\{id\}`\)/)
})

