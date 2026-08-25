import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// India-specific terminology must not appear in ACTIVE user-facing product code.
// Legitimate exceptions are handled explicitly (e.g. the retained `panNumber`
// field is displayed as "Tax ID / EIN", and the legacy NBFC/NPR schema values
// are documented as backward-compat-only and never surfaced by active code).

test('active UI has no India-specific banking badge (NBFC removed)', () => {
  const cards = read('components/design/Cards.tsx')
  assert.doesNotMatch(cards, /NBFC/, 'NBFC (Indian banking term) must not appear in active UI')
})

test('active broker/company/profile UI contains no India-specific fields or terms', () => {
  const files = [
    'components/sections/broker/BrokerSetupWizard.tsx',
    'components/sections/broker/EditProfile.tsx',
    'components/sections/broker/CompanyProfile.tsx',
    'components/sections/broker/BrokerProfile.tsx',
    'app/admin/brokers/create/AdminBrokerForm.tsx',
    'app/admin/brokers/[id]/AdminBrokerActions.tsx',
    'components/forms/BrokerContactForm.tsx',
  ]
  for (const file of files) {
    const content = read(file)
    for (const term of ['GST', 'gstNumber', 'Aadhaar', 'aadhaarCard', 'indianCities', 'Permanent Account Number', '₹', 'INR', '+91']) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      assert.doesNotMatch(content, new RegExp(escaped), `${file} must not contain ${term}`)
    }
  }
})

test('landing/marketing + FAQ content is US-focused with no rupee or India claims', () => {
  const landing = read('components/sections/landing/CallToAction.tsx')
  assert.match(landing, /verified mortgage brokers/)
  assert.doesNotMatch(landing, /₹|INR|rupee|GST|in India|India's/)
  const seed = read('prisma/seed/index.ts')
  assert.doesNotMatch(seed, /₹|INR|rupee|Mumbai|Delhi|Bengaluru/)
  // Seed demo brokers are US-based.
  assert.match(seed, /city: 'San Diego', state: 'CA'/)
  assert.match(seed, /city: 'Austin', state: 'TX'/)
})

test('phone validation is US-appropriate (7-15 digits, no +91 assumption)', () => {
  const admin = read('lib/admin-broker.ts')
  const registration = read('lib/broker-registration.ts')
  assert.match(admin, /phoneDigits\.length < 7 \|\| phoneDigits\.length > 15/)
  assert.match(registration, /phoneDigits\.length < 7 \|\| phoneDigits\.length > 15/)
  assert.doesNotMatch(admin, /\+91/)
})

test('site/seed currency defaults are USD', () => {
  const settings = read('lib/site/settings.ts')
  const seed = read('prisma/seed/index.ts')
  assert.match(settings, /defaultCurrency: 'USD'/)
  assert.match(seed, /defaultCurrency: \['USD'/)
})

test('schema documents the two intentionally-retained legacy values (NBFC enum, NPR default)', () => {
  const schema = read('prisma/schema.prisma')
  // The legacy NBFC enum member and NPR Property default remain for backward
  // compatibility and are explicitly documented as not used by the US product.
  assert.match(schema, /Legacy India-era classification/)
  assert.match(schema, /Legacy Nepal-era default/)
  assert.match(schema, /NBFC/)
  assert.match(schema, /@default\("NPR"\)/)
})