import assert from 'node:assert/strict'
import test from 'node:test'
import { isFormatCompatible } from '../lib/advertisements/formats'
import { validateCreativeDimensions, getRequiredDimensions } from '../lib/advertisements/placementSpecs'
import { getCreativeRequirementForFormat } from '../lib/advertisements/requirements'
import { formatAspectRatio, aspectRatioClass, formatAspectClass } from '../lib/advertisements/formatAspect'

// ---------------------------------------------------------------------------
// 1600 × 1000 (aspect 8:5) is recognized as a supported advertisement format
// ---------------------------------------------------------------------------

test('WIDE_RECTANGLE is a registered format', () => {
  assert.ok(isFormatCompatible('BROKER_LISTING_LOCAL', 'WIDE_RECTANGLE'))
  assert.equal(getRequiredDimensions('BROKER_LISTING_LOCAL', 'WIDE_RECTANGLE', 'desktop').width, 1600)
  assert.equal(getRequiredDimensions('BROKER_LISTING_LOCAL', 'WIDE_RECTANGLE', 'desktop').height, 1000)
  assert.equal(getRequiredDimensions('BROKER_LISTING_LOCAL', 'WIDE_RECTANGLE', 'desktop').aspectRatio, '8:5')
})

test('WIDE_RECTANGLE mobile contract resolves to 800x500 8:5', () => {
  const mobile = getRequiredDimensions('BROKER_LISTING_LOCAL', 'WIDE_RECTANGLE', 'mobile')
  assert.equal(mobile.width, 800)
  assert.equal(mobile.height, 500)
  assert.equal(mobile.aspectRatio, '8:5')
})

// ---------------------------------------------------------------------------
// Valid 1600 × 1000 passes validation
// ---------------------------------------------------------------------------

test('valid 1600 × 1000 WIDE_RECTANGLE creative passes validation', () => {
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'WIDE_RECTANGLE', 1600, 1000).ok, true)
})

// ---------------------------------------------------------------------------
// Incorrect dimensions are rejected
// ---------------------------------------------------------------------------

test('incorrect width is rejected', () => {
  const result = validateCreativeDimensions('BROKER_LISTING_LOCAL', 'WIDE_RECTANGLE', 1599, 1000)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.requiredWidth, 1600)
})

test('incorrect height is rejected', () => {
  const result = validateCreativeDimensions('BROKER_LISTING_LOCAL', 'WIDE_RECTANGLE', 1600, 999)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.requiredHeight, 1000)
})

test('an off-ratio creative is rejected', () => {
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'WIDE_RECTANGLE', 1600, 800).ok, false)
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'WIDE_RECTANGLE', 1200, 1000).ok, false)
})

test('invalid dimensions produce a descriptive reason', () => {
  const result = validateCreativeDimensions('BROKER_LISTING_LOCAL', 'WIDE_RECTANGLE', 1280, 720)
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.reason, /requires exactly 1600 × 1000 px/)
})

// ---------------------------------------------------------------------------
// Existing supported sizes still pass
// ---------------------------------------------------------------------------

test('existing formats still validate at their canonical dimensions', () => {
  assert.equal(validateCreativeDimensions('HOMEPAGE_HERO', 'HORIZONTAL', 1600, 300).ok, true)
  assert.equal(validateCreativeDimensions('HOMEPAGE_FEATURED', 'SQUARE', 800, 800).ok, true)
  assert.equal(validateCreativeDimensions('HOMEPAGE_HERO', 'RECTANGLE', 1200, 800).ok, true)
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'BANNER', 1600, 800).ok, true)
  assert.equal(validateCreativeDimensions('HOMEPAGE_HERO', 'MOBILE', 750, 320, 'mobile').ok, true)
})

test('existing invalid sizes remain rejected', () => {
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'BANNER', 1600, 1000).ok, false)
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'SQUARE', 600, 600).ok, false)
})

// ---------------------------------------------------------------------------
// Format requirement resolution exposes the new size
// ---------------------------------------------------------------------------

test('getCreativeRequirementForFormat returns the 1600x1000 resolution', () => {
  const req = getCreativeRequirementForFormat('BROKER_LISTING_LOCAL', 'WIDE_RECTANGLE')
  assert.equal(req.width, 1600)
  assert.equal(req.height, 1000)
  assert.equal(req.aspectRatio, '8:5')
  assert.equal(req.mobileWidth, 800)
  assert.equal(req.mobileHeight, 500)
  assert.equal(req.mobileAspectRatio, '8:5')
  assert.equal(req.label, 'Wide Rectangle')
})

// ---------------------------------------------------------------------------
// Aspect ratio helpers map WIDE_RECTANGLE to 8:5 / aspect-[8/5]
// ---------------------------------------------------------------------------

test('aspect helpers resolve WIDE_RECTANGLE to 8:5', () => {
  assert.equal(formatAspectRatio('WIDE_RECTANGLE'), '8:5')
  assert.equal(aspectRatioClass('8:5'), 'aspect-[8/5]')
  assert.equal(formatAspectClass('WIDE_RECTANGLE'), 'aspect-[8/5]')
})
