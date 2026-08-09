import assert from 'node:assert/strict'
import test from 'node:test'
import { isFormatCompatible } from '../lib/advertisements/formats'
import { getFormatRequirement, getPlacementSpec, getRequiredDimensions, getDisplayHeight, validateCreativeDimensions } from '../lib/advertisements/placementSpecs'

test('placement determines allowed formats from the canonical contract', () => {
  assert.ok(isFormatCompatible('HOMEPAGE_HERO', 'HORIZONTAL'))
  assert.equal(isFormatCompatible('HOMEPAGE_HERO', 'VERTICAL'), false)
  assert.equal(isFormatCompatible('BROKER_LISTING_SIDEBAR', 'VERTICAL'), true)
})

test('every seeded placement has a compact size contract', () => {
  for (const placement of ['HOMEPAGE_HERO', 'HOMEPAGE_SEARCH', 'HOMEPAGE_FEATURED', 'BROKER_LISTING', 'BROKER_LISTING_SIDEBAR', 'BROKER_PROFILE_HEADER', 'BLOG_INLINE', 'FOOTER', 'ANNOUNCEMENT_TOP', 'ANNOUNCEMENT_BOTTOM', 'POPUP_OVERLAY', 'MOBILE_HEADER_BANNER']) {
    const spec = getPlacementSpec(placement)
    assert.ok(spec, placement)
    const primary = getFormatRequirement(spec.formats[0])
    assert.ok(primary.width > 0 && primary.height > 0, placement)
    assert.equal(spec.compact, true, placement)
    const desktopHeight = getDisplayHeight(placement, 'desktop')
    assert.ok(desktopHeight <= 400, `${placement} desktop height ${desktopHeight}`)
  }
})

test('full-width banner placements use a compact 150px-max display height', () => {
  for (const placement of ['HOMEPAGE_HERO', 'HOMEPAGE_SEARCH', 'HOMEPAGE_FEATURED', 'HOMEPAGE_SERVICES', 'HOMEPAGE_CTA', 'BROKER_LISTING', 'BROKER_PROFILE_HEADER', 'BLOG_INLINE', 'LOAN_CALCULATOR']) {
    assert.ok(getDisplayHeight(placement, 'desktop') <= 150, `${placement} desktop ${getDisplayHeight(placement, 'desktop')}`)
    assert.ok(getDisplayHeight(placement, 'mobile') <= 100, `${placement} mobile ${getDisplayHeight(placement, 'mobile')}`)
    assert.ok(getDisplayHeight(placement, 'mobile') < getDisplayHeight(placement, 'tablet'), placement)
    assert.ok(getDisplayHeight(placement, 'tablet') < getDisplayHeight(placement, 'desktop'), placement)
    assert.ok(getDisplayHeight(placement, 'desktop') >= 120, placement)
  }
})

test('non-banner placements remain compact', () => {
  assert.ok(getDisplayHeight('BROKER_LISTING_SIDEBAR', 'desktop') <= 250)
  assert.ok(getDisplayHeight('FOOTER', 'desktop') <= 100)
  assert.ok(getDisplayHeight('ANNOUNCEMENT_TOP', 'desktop') <= 100)
})

test('valid desktop creative is accepted', () => {
  const result = validateCreativeDimensions('HOMEPAGE_HERO', 'HORIZONTAL', 1600, 300, 'desktop')
  assert.equal(result.ok, true)
})

test('excessively tall creative is rejected', () => {
  const result = validateCreativeDimensions('HOMEPAGE_HERO', 'HORIZONTAL', 1600, 1400, 'desktop')
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.reason, /too tall/)
})

test('wrong aspect ratio is rejected', () => {
  const result = validateCreativeDimensions('BLOG_INLINE', 'RECTANGLE', 800, 800, 'desktop')
  assert.equal(result.ok, false)
})

test('mobile creative is validated against the mobile contract', () => {
  const ok = validateCreativeDimensions('HOMEPAGE_HERO', 'MOBILE', 750, 320, 'mobile')
  assert.equal(ok.ok, true)
  const bad = validateCreativeDimensions('HOMEPAGE_HERO', 'MOBILE', 750, 750, 'mobile')
  assert.equal(bad.ok, false)
})

test('required dimensions reflect the format contract', () => {
  const desktop = getRequiredDimensions('HOMEPAGE_HERO', 'HORIZONTAL', 'desktop')
  assert.deepEqual({ width: desktop.width, height: desktop.height }, { width: 1600, height: 300 })
})
