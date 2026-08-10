import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

test('Phase 2 homepage uses the local hero asset and real broker search route', () => {
  const hero = read('components/sections/landing/Hero.tsx')
  assert.ok(hero.includes("'/assets/images/cover.jpg'"))
  assert.ok(hero.includes("router.push(queryString ? `/brokers?${queryString}` : '/brokers')"))
  assert.ok(hero.includes('Search brokers'))
})

test('Phase 2 public contact form has a public POST handler', () => {
  const page = read('app/(public)/contact/page.tsx')
  const route = read('app/api/admin/contact/route.ts')
  assert.ok(page.includes("fetch('/api/admin/contact'"))
  assert.ok(route.includes('export async function POST'))
  assert.ok(route.includes('contactBrokerRateLimit'))
  assert.ok(route.includes('sendEmail'))
})

test('Phase 2 admin navigation points only to implemented primary areas', () => {
  const source = read('components/layout/admin/sideBarData.ts')
  const adminBlock = source.slice(source.indexOf('const adminNavItems'), source.indexOf('// ==================== BROKER NAVIGATION'))
  assert.ok(adminBlock.includes('url: "/admin"'))
  assert.ok(adminBlock.includes('url: "/admin/brokers"'))
  assert.ok(adminBlock.includes('url: "/admin/ads"'))
  assert.ok(adminBlock.includes('url: "/admin/content"'))
  assert.ok(adminBlock.includes('url: "/admin/faqs"'))
  assert.equal(adminBlock.includes('url: "/admin/users"'), false)
  assert.equal(adminBlock.includes('url: "/admin/analytics"'), false)
})

test('Phase 2 onboarding uses US-oriented defaults', () => {
  const source = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.ok(source.includes("specializations: ['Home Purchase']"))
  assert.ok(source.includes("languages: ['English', 'Spanish']"))
  assert.ok(source.includes("currentStep === 4 && 'Review and submit your application'"))
})

test('Phase 2 calculator guards manual loan amount input', () => {
  const source = read('app/(public)/calculator/page.tsx')
  assert.ok(source.includes('Math.max(50000, value)'))
  assert.ok(source.includes('Number.isFinite(value)'))
})

test('Phase 2 newsletter uses a real server endpoint and error state', () => {
  const footer = read('components/layout/Footer.tsx')
  const route = read('app/api/newsletter/route.ts')
  assert.ok(footer.includes("fetch('/api/newsletter'"))
  assert.ok(footer.includes('newsletterError'))
  assert.ok(route.includes('export async function POST'))
  assert.ok(route.includes('idempotencyKey: `newsletter_${email}`'))
})

test('Phase 2 broker dashboard avoids fabricated trend metrics', () => {
  const source = read('components/sections/broker/BrokerDashboard.tsx')
  assert.ok(source.includes('change: null'))
  assert.ok(source.includes('Current total'))
  assert.ok(source.includes('Detailed analytics will appear here'))
})
