import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// Broker admin pages should query and display ALL stored plans
test('1. Broker list page queries all plans (no isActive filter)', () => {
  const page = read('app/admin/billing/broker-plans/page.tsx')
  const findManyMatch = page.match(/brokerSubscriptionPlan\.findMany\([^)]*\)/s)
  assert.ok(findManyMatch, 'findMany call found')
  const call = findManyMatch[0]
  // Should NOT filter by isActive: true in the main plan query
  assert.doesNotMatch(call, /where:.*isActive.*true/)
})

test('2. Broker list page maps ALL returned plans for display', () => {
  const page = read('app/admin/billing/broker-plans/page.tsx')
  assert.match(page, /plans\.map/)
  assert.match(page, /{plans\.map\(.*plan.*=>/)
})

test('3. Broker list page shows inactive status in UI', () => {
  const page = read('app/admin/billing/broker-plans/page.tsx')
  assert.match(page, /plan\.isActive.*Active.*Inactive/)
})

test('4. Company list page queries all plans (no isActive filter)', () => {
  const page = read('app/admin/billing/company-advertising-plans/page.tsx')
  const findManyMatch = page.match(/companyAdvertisingPlan\.findMany\([^)]*\)/s)
  assert.ok(findManyMatch, 'findMany call found')
  const call = findManyMatch[0]
  assert.doesNotMatch(call, /where:.*isActive.*true/)
})

test('5. Company list page maps ALL returned plans', () => {
  const page = read('app/admin/billing/company-advertising-plans/page.tsx')
  assert.match(page, /plans\.map/)
})

test('6. Broker admin GET returns plans response', () => {
  const api = read('app/api/admin/broker-plans/route.ts')
  assert.match(api, /return NextResponse\.json\(\s*\{\s*plans:/)
})

test('7. Company admin GET returns plans response', () => {
  const api = read('app/api/admin/company-advertising-plans/route.ts')
  assert.match(api, /return NextResponse\.json\(\s*\{\s*plans:/)
})

test('8. Broker create form shows supported plans availability', () => {
  const form = read('app/admin/billing/broker-plans/new/page.tsx')
  assert.match(form, /Already configured/)
  assert.match(form, /Available/)
})

test('9. Broker create API enforces duplicate detection', () => {
  const api = read('app/api/admin/broker-plans/route.ts')
  assert.match(api, /A plan with this code already exists/)
  assert.match(api, /status: 409/)
})

test('10. Company create API enforces duplicate detection', () => {
  const api = read('app/api/admin/company-advertising-plans/route.ts')
  assert.match(api, /A plan with this name already exists/)
  assert.match(api, /status: 409/)
})

