import assert from 'node:assert/strict'
import test from 'node:test'
import { getPlacementFormats, isFormatCompatible } from '../lib/advertisements/formats'
import { validateCreativeDimensions } from '../lib/advertisements/placementSpecs'

test('exact valid dimensions are accepted (SQUARE 800 × 800)', () => {
  assert.equal(validateCreativeDimensions('HOMEPAGE_FEATURED', 'SQUARE', 800, 800).ok, true)
})

test('valid RECTANGLE and HORIZONTAL are accepted', () => {
  assert.equal(validateCreativeDimensions('HOMEPAGE_HERO', 'RECTANGLE', 1200, 800).ok, true)
  assert.equal(validateCreativeDimensions('HOMEPAGE_HERO', 'HORIZONTAL', 1600, 300).ok, true)
})

test('valid MOBILE is accepted against the mobile contract', () => {
  assert.equal(validateCreativeDimensions('HOMEPAGE_HERO', 'MOBILE', 750, 320, 'mobile').ok, true)
})

test('width one pixel off is rejected', () => {
  const result = validateCreativeDimensions('HOMEPAGE_FEATURED', 'SQUARE', 799, 800)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.requiredWidth, 800)
})

test('height one pixel off is rejected', () => {
  const result = validateCreativeDimensions('HOMEPAGE_FEATURED', 'SQUARE', 800, 799)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.requiredHeight, 800)
})

test('both dimensions incorrect is rejected', () => {
  assert.equal(validateCreativeDimensions('HOMEPAGE_FEATURED', 'SQUARE', 1000, 1000).ok, false)
  assert.equal(validateCreativeDimensions('HOMEPAGE_FEATURED', 'SQUARE', 1200, 800).ok, false)
})

test('wrong aspect ratio is rejected (800 × 800 vs RECTANGLE 3:2)', () => {
  assert.equal(validateCreativeDimensions('BLOG_INLINE', 'RECTANGLE', 800, 800).ok, false)
})

test('mobile creative with wrong dimensions is rejected', () => {
  assert.equal(validateCreativeDimensions('HOMEPAGE_HERO', 'MOBILE', 750, 750, 'mobile').ok, false)
})

test('failure result reports the exact required and uploaded resolution', () => {
  const result = validateCreativeDimensions('HOMEPAGE_FEATURED', 'SQUARE', 1200, 800)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.actualWidth, 1200)
    assert.equal(result.actualHeight, 800)
    assert.match(result.reason, /1200 × 800 px but HOMEPAGE_FEATURED requires exactly 800 × 800 px/)
  }
})

test('BROKER_LISTING_LOCAL allows SQUARE and BANNER creative', () => {
  assert.deepEqual(getPlacementFormats('BROKER_LISTING_LOCAL'), ['SQUARE', 'BANNER'])
  assert.equal(isFormatCompatible('BROKER_LISTING_LOCAL', 'SQUARE'), true)
  assert.equal(isFormatCompatible('BROKER_LISTING_LOCAL', 'BANNER'), true)
  assert.equal(isFormatCompatible('BROKER_LISTING_LOCAL', 'RECTANGLE'), false)
  assert.equal(isFormatCompatible('BROKER_LISTING_LOCAL', 'HORIZONTAL'), false)
})

test('BROKER_LISTING_LOCAL SQUARE requirement resolves to the canonical square spec', () => {
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'SQUARE', 800, 800).ok, true)
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'SQUARE', 600, 600).ok, false)
})

test('BROKER_LISTING_LOCAL BANNER requirement resolves to the canonical 1600x800 2:1 spec', () => {
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'BANNER', 1600, 800).ok, true)
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'BANNER', 1200, 800).ok, false)
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'BANNER', 1600, 1200).ok, false)
  const result = validateCreativeDimensions('BROKER_LISTING_LOCAL', 'BANNER', 1600, 800)
  assert.equal(result.ok, true)
})
