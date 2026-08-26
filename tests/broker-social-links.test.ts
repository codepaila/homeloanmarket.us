import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  isSafeHttpUrl,
  normalizeSocialLink,
  normalizeSocialLinks,
  hasAnySocialLink,
} from '@/lib/broker-social-links'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ==================== UNIT — URL validation ====================

test('isSafeHttpUrl accepts http/https only', () => {
  assert.equal(isSafeHttpUrl('https://facebook.com/example'), true)
  assert.equal(isSafeHttpUrl('http://facebook.com/example'), true)
  assert.equal(isSafeHttpUrl('https://www.instagram.com/brand/'), true)
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false)
  assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false)
  assert.equal(isSafeHttpUrl('vbscript:msgbox(1)'), false)
  assert.equal(isSafeHttpUrl('ftp://example.com'), false)
  assert.equal(isSafeHttpUrl('not a url'), false)
  assert.equal(isSafeHttpUrl(''), false)
  assert.equal(isSafeHttpUrl('   '), false)
})

// ==================== UNIT — normalization ====================

test('normalizeSocialLink trims, clears empties, and rejects dangerous schemes', () => {
  assert.deepEqual(normalizeSocialLink(' https://twitter.com/brand ', 'twitter'), { ok: true, value: 'https://twitter.com/brand' })
  assert.deepEqual(normalizeSocialLink('', 'facebook'), { ok: true, value: null })
  assert.deepEqual(normalizeSocialLink(null, 'linkedin'), { ok: true, value: null })
  assert.deepEqual(normalizeSocialLink(undefined, 'instagram'), { ok: true, value: null })
  assert.deepEqual(normalizeSocialLink('   ', 'facebook'), { ok: true, value: null })
  const bad = normalizeSocialLink('javascript:alert(1)', 'facebook')
  assert.equal(bad.ok, false)
  if (!bad.ok) assert.match(bad.error, /https:\/\/ URL/)
  const notString = normalizeSocialLink(12345, 'twitter')
  assert.equal(notString.ok, false)
})

test('normalizeSocialLinks rebuilds the whole object when any key is present', () => {
  const result = normalizeSocialLinks({
    facebook: 'https://facebook.com/acme',
    twitter: '',
    linkedin: undefined,
    instagram: 'https://instagram.com/acme',
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.deepEqual(result.value, {
      facebook: 'https://facebook.com/acme',
      twitter: null,
      linkedin: null,
      instagram: 'https://instagram.com/acme',
    })
  }
})

test('normalizeSocialLinks rejects a single invalid URL and reports the field', () => {
  const result = normalizeSocialLinks({
    facebook: 'https://facebook.com/acme',
    twitter: 'javascript:alert(1)',
    linkedin: '',
    instagram: '',
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /Twitter \/ X/)
})

test('normalizeSocialLinks returns an empty object when no social key is present', () => {
  const result = normalizeSocialLinks({})
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.value, {})
})

test('hasAnySocialLink only reports objects containing a URL', () => {
  assert.equal(hasAnySocialLink({ facebook: 'https://facebook.com/x', twitter: null }), true)
  assert.equal(hasAnySocialLink({ facebook: null, twitter: null, linkedin: null, instagram: null }), false)
  assert.equal(hasAnySocialLink({}), false)
  assert.equal(hasAnySocialLink(null), false)
})

// ==================== WIRING — schema ====================

test('Broker model has a single canonical socialLinks JSON field', () => {
  const schema = read('prisma/schema.prisma')
  assert.match(schema, /model Broker \{/)
  assert.match(schema, /socialLinks Json\?/)
  // The field is dedicated to the four social keys; no separate columns.
  assert.doesNotMatch(schema, /facebook String\?/)
  assert.doesNotMatch(schema, /twitter String\?/)
})

test('company models do NOT gain social fields', () => {
  const schema = read('prisma/schema.prisma')
  assert.match(schema, /model Company \{/)
  assert.match(schema, /model CompanySubscription \{/)
  assert.match(schema, /model CompanyAdvertisingPlan \{/)
  // socialLinks appears exactly once in the schema (Broker only).
  assert.equal((schema.match(/socialLinks Json\?/g) || []).length, 1)
})

// ==================== WIRING — update API ====================

test('PATCH /api/brokers/me persists socialLinks and validates server-side', () => {
  const route = read('app/api/brokers/me/route.ts')
  assert.match(route, /normalizeSocialLinks/)
  assert.match(route, /SOCIAL_LINK_KEYS\.some/)
  assert.match(route, /updateData\.socialLinks/)
  assert.match(route, /Prisma\.DbNull/)
})

test('PATCH /api/brokers/me retains broker-only authorization', () => {
  const route = read('app/api/brokers/me/route.ts')
  assert.match(route, /currentUser\.role !== 'BROKER'/)
  assert.match(route, /Authentication required/)
  assert.match(route, /Only brokers can update their profile/)
  assert.match(route, /where: \{ userId: currentUser\.id \}/)
})

// ==================== WIRING — GET / serialization ====================

test('broker company-profile edit page DTO includes socialLinks', () => {
  const page = read('app/broker/company/edit/page.tsx')
  assert.match(page, /socialLinks: brokerProfile\.socialLinks/)
})

test('toBrokerOwnerDto passes socialLinks through', () => {
  const dto = read('lib/broker-owner-dto.ts')
  assert.match(dto, /socialLinks: Prisma\.JsonValue \| null/)
  assert.match(dto, /socialLinks: \(broker\.socialLinks \?\? null\) as Record<string, string \| null> \| null,/)
})

test('public serialization exposes socialLinks without private broker data', () => {
  const pub = read('lib/public-broker.ts')
  // Protected/private fields are stripped; socialLinks is public by design.
  assert.match(pub, /email: _email,/)
  assert.match(pub, /phone: _phone,/)
  assert.match(pub, /userId: _userId,/)
  // The public record is a spread of the broker, so socialLinks survives while
  // private fields are explicitly destructured away.
  assert.match(pub, /\.\.\.publicBroker/)
})

// ==================== WIRING — edit form ====================

test('edit form reads saved social values from the canonical socialLinks object', () => {
  const form = read('components/sections/broker/EditProfile.tsx')
  assert.match(form, /broker\?\.socialLinks\?\.facebook \|\| ''/)
  assert.match(form, /broker\?\.socialLinks\?\.twitter \|\| ''/)
  assert.match(form, /broker\?\.socialLinks\?\.linkedin \|\| ''/)
  assert.match(form, /broker\?\.socialLinks\?\.instagram \|\| ''/)
})

test('edit form submits the social fields and validates http(s) client-side', () => {
  const form = read('components/sections/broker/EditProfile.tsx')
  // Fields are part of the schema and the save payloads.
  assert.match(form, /name="facebook"/)
  assert.match(form, /name="twitter"/)
  assert.match(form, /name="linkedin"/)
  assert.match(form, /name="instagram"/)
  assert.match(form, /tabData\.facebook = formData\.facebook/)
  assert.match(form, /tabData\.instagram = formData\.instagram/)
  assert.match(form, /isSafeHttpUrl/)
})

// ==================== WIRING — regression ====================

test('social links are Broker-only: no social handling added to company user/profile routes', () => {
  const schema = read('prisma/schema.prisma')
  const company = schema.slice(schema.indexOf('model Company {'))
  assert.doesNotMatch(company, /socialLinks/)
})
