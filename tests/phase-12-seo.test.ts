import assert from 'node:assert/strict'
import test from 'node:test'
import robots from '../app/robots'
import { canonicalUrl, getSiteUrl, isIndexablePublicBroker, safeJsonLd } from '../lib/seo'

const verified = {
  isVisible: true,
  verificationStatus: 'VERIFIED' as const,
  brokerStatus: 'FREE' as const,
}

test('canonical URLs remove query variants and trailing slashes', () => {
  assert.equal(canonicalUrl('/brokers/example/?utm_source=test'), 'https://homeloanmarket.com/brokers/example')
  assert.equal(canonicalUrl('/'), 'https://homeloanmarket.com/')
})

test('local auth/app URLs cannot become public SEO origins', () => {
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const previousAuthUrl = process.env.NEXTAUTH_URL
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  process.env.NEXTAUTH_URL = 'http://127.0.0.1:3100'
  assert.equal(getSiteUrl(), 'https://homeloanmarket.com')
  if (previousAppUrl === undefined) Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_APP_URL')
  else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl
  if (previousAuthUrl === undefined) Reflect.deleteProperty(process.env, 'NEXTAUTH_URL')
  else process.env.NEXTAUTH_URL = previousAuthUrl
})

test('only eligible public Brokers are indexable', () => {
  assert.equal(isIndexablePublicBroker({ ...verified, userId: null }), true)
  assert.equal(isIndexablePublicBroker({ ...verified, userId: 'user-1', userIsActive: false }), false)
  assert.equal(isIndexablePublicBroker({ ...verified, brokerStatus: 'SUSPENDED', userId: null }), false)
  assert.equal(isIndexablePublicBroker({ ...verified, isVisible: false, userId: null }), false)
})

test('robots allows public pages and blocks private/API paths', () => {
  const result = robots()
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules
  assert.equal(rules.allow, '/')
  assert.deepEqual(rules.disallow, ['/admin/', '/broker/', '/dashboard/', '/api/', '/auth/', '/claim-broker/'])
  assert.equal(result.sitemap, 'https://homeloanmarket.com/sitemap.xml')
})

test('JSON-LD escaping cannot terminate its script element', () => {
  const encoded = safeJsonLd({ description: '</script><script>alert(1)</script>' })
  assert.equal(encoded.includes('</script>'), false)
  assert.equal(encoded.includes('\\u003c/script>'), true)
})
