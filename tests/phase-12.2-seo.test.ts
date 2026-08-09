import assert from 'node:assert/strict'
import test from 'node:test'
import { isIndexablePublicBroker, canonicalUrl, getSiteUrl } from '../lib/seo'
import { toPublicBrokerRecord } from '../lib/public-broker'

function withEnvironment(values: Record<string, string | undefined>, callback: () => void) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) Reflect.deleteProperty(process.env, key)
    else process.env[key] = value
  }
  try {
    callback()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key)
      else process.env[key] = value
    }
  }
}

test('production URL wins over local development origins', () => {
  withEnvironment({
    NEXT_PUBLIC_SITE_URL: 'https://staging.example.test',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXTAUTH_URL: 'http://127.0.0.1:3100',
  }, () => {
    assert.equal(getSiteUrl(), 'https://staging.example.test')
  })
})

test('loopback, unspecified, and private origins cannot become SEO origins', () => {
  withEnvironment({
    NEXT_PUBLIC_SITE_URL: 'http://0.0.0.0:3000',
    NEXT_PUBLIC_APP_URL: 'http://192.168.1.10:3000',
    NEXT_PUBLIC_URL: 'http://service.internal:3000',
    NEXTAUTH_URL: 'http://[::1]:3000',
  }, () => {
    assert.equal(getSiteUrl(), 'https://homeloanmarket.com')
  })
})

test('canonicalization removes query strings and trailing slashes', () => {
  assert.equal(canonicalUrl('https://homeloanmarket.com/brokers/demo/?utm_campaign=x#reviews'), 'https://homeloanmarket.com/brokers/demo')
})

test('public Broker projection strips internal identifiers and relations', () => {
  const projected = toPublicBrokerRecord({
    id: 'broker-internal',
    userId: 'owner-internal',
    displayName: 'Public Broker',
    email: 'public@example.test',
    subscription: { plan: 'FEATURED', isActive: true },
     user: { id: 'user-internal', name: 'Public Owner', image: null, isActive: true },
     bankPartners: [{ id: 'bank-internal', brokerId: 'broker-internal', bankName: 'Public Bank', bankType: 'PRIVATE' }],
    reviews: [{ id: 'review-internal', brokerId: 'broker-internal', userId: 'reviewer-internal', rating: 5, comment: 'Good', user: { id: 'reviewer-internal', name: 'Reviewer', image: null } }],
  }) as Record<string, unknown>

  assert.equal('id' in projected, false)
  assert.equal('userId' in projected, false)
  assert.equal('subscription' in projected, false)
  assert.equal('registrationNumber' in projected, false)
  assert.deepEqual(projected.user, { name: 'Public Owner', image: null })
  assert.deepEqual(projected.bankPartners, [{ bankName: 'Public Bank', bankType: 'PRIVATE', since: undefined }])
  assert.deepEqual(projected.reviews, [{ rating: 5, comment: 'Good', createdAt: undefined, user: { name: 'Reviewer', image: null } }])
})

test('suspended and inactive-owner Brokers remain excluded from indexability', () => {
  const valid = { isVisible: true, verificationStatus: 'VERIFIED' as const, brokerStatus: 'FREE' as const }
  assert.equal(isIndexablePublicBroker({ ...valid, userId: null }), true)
  assert.equal(isIndexablePublicBroker({ ...valid, brokerStatus: 'SUSPENDED', userId: null }), false)
  assert.equal(isIndexablePublicBroker({ ...valid, userId: 'owner', userIsActive: false }), false)
})
