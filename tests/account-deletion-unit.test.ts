import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isTerminalStripeStatus,
  isActiveStripeStatus,
  isStripeResourceMissingError,
  dedupeStripeSubIds,
  isLocalAssetUrl,
  localPathForAssetUrl,
  cloudinaryPublicIdFromUrl,
} from '@/lib/account-deletion'

test('isTerminalStripeStatus recognizes canceled and incomplete_expired', () => {
  assert.equal(isTerminalStripeStatus('canceled'), true)
  assert.equal(isTerminalStripeStatus('incomplete_expired'), true)
  assert.equal(isTerminalStripeStatus('active'), false)
  assert.equal(isTerminalStripeStatus('trialing'), false)
  assert.equal(isTerminalStripeStatus('past_due'), false)
  assert.equal(isTerminalStripeStatus(''), false)
})

test('isActiveStripeStatus recognizes billable statuses', () => {
  assert.equal(isActiveStripeStatus('active'), true)
  assert.equal(isActiveStripeStatus('trialing'), true)
  assert.equal(isActiveStripeStatus('past_due'), true)
  assert.equal(isActiveStripeStatus('unpaid'), true)
  assert.equal(isActiveStripeStatus('canceled'), false)
  assert.equal(isActiveStripeStatus('incomplete_expired'), false)
})

test('isStripeResourceMissingError detects Stripe 404-style errors only', () => {
  assert.equal(isStripeResourceMissingError({ code: 'resource_missing' }), true)
  assert.equal(isStripeResourceMissingError({ type: 'StripeInvalidRequestError' }), true)
  assert.equal(isStripeResourceMissingError({ code: 'StripeConnectionError' }), false)
  assert.equal(isStripeResourceMissingError(new Error('network down')), false)
  assert.equal(isStripeResourceMissingError(null), false)
  assert.equal(isStripeResourceMissingError('boom'), false)
})

test('dedupeStripeSubIds removes null/undefined and duplicates while preserving order', () => {
  assert.deepEqual(dedupeStripeSubIds(null, undefined, 'a', 'b', 'a'), ['a', 'b'])
  assert.deepEqual(dedupeStripeSubIds(), [])
  // A broker's registration subscription and broker subscription may reference
  // the SAME Stripe subscription — dedupe means it is cancelled exactly once.
  assert.deepEqual(dedupeStripeSubIds('sub_123', 'sub_123'), ['sub_123'])
})

test('isLocalAssetUrl only accepts local uploads', () => {
  assert.equal(isLocalAssetUrl('/uploads/media/abc.webp'), true)
  assert.equal(isLocalAssetUrl('/uploads/brokers/logo/x.webp'), true)
  assert.equal(isLocalAssetUrl('https://res.cloudinary.com/cloud/image/upload/v1/x.webp'), false)
  assert.equal(isLocalAssetUrl(null), false)
  assert.equal(isLocalAssetUrl(undefined), false)
  assert.equal(isLocalAssetUrl(''), false)
})

test('localPathForAssetUrl maps local URLs under public/ and ignores externals', () => {
  const mapped = localPathForAssetUrl('/uploads/media/abc.webp')
  assert.ok(mapped && mapped.endsWith('public/uploads/media/abc.webp'))
  assert.equal(localPathForAssetUrl('https://res.cloudinary.com/cloud/image/upload/v1/x.webp'), null)
  assert.equal(localPathForAssetUrl('/not-uploads/x.webp'), null)
})

test('cloudinaryPublicIdFromUrl derives the public_id from res.cloudinary.com URLs only', () => {
  assert.equal(
    cloudinaryPublicIdFromUrl('https://res.cloudinary.com/homeloanmarket/image/upload/v1234567890/homeloanmarket/brokers/logo/abc123.webp'),
    'homeloanmarket/brokers/logo/abc123',
  )
  assert.equal(
    cloudinaryPublicIdFromUrl('https://res.cloudinary.com/homeloanmarket/image/upload/v1/homeloanmarket/users/avatar/xyz.webp'),
    'homeloanmarket/users/avatar/xyz',
  )
  assert.equal(cloudinaryPublicIdFromUrl('https://example.com/image.webp'), null)
  assert.equal(cloudinaryPublicIdFromUrl('/uploads/media/abc.webp'), null)
  assert.equal(cloudinaryPublicIdFromUrl(null), null)
  assert.equal(cloudinaryPublicIdFromUrl('not a url'), null)
})
