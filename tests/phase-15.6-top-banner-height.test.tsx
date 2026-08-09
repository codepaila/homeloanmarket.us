import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { getDisplayHeight, getPlacementSpec, getRequiredDimensions, FULL_WIDTH_BANNER_DISPLAY } from '../lib/advertisements/placementSpecs'
import { getAdvertisementLayout, AD_PLACEMENT_CONFIG } from '../components/advertisements/ad-layout'
import { getPlacementInfo } from '../components/admin/ads/placementPreviews'

const TOP_FULL_WIDTH_PLACEMENTS = [
  'HOMEPAGE_HERO',
  'HOMEPAGE_SEARCH',
  'HOMEPAGE_FEATURED',
  'HOMEPAGE_SERVICES',
  'HOMEPAGE_BANKS',
  'HOMEPAGE_CTA',
  'BROKER_LISTING',
  'BROKER_PROFILE_HEADER',
  'LOAN_CALCULATOR',
  'BLOG_INLINE',
]

test('top full-width banner placements never exceed 150px displayed height on desktop', () => {
  for (const placement of TOP_FULL_WIDTH_PLACEMENTS) {
    const desktop = getDisplayHeight(placement, 'desktop')
    assert.ok(desktop <= 150, `${placement} desktop height ${desktop} exceeds the 150px top-banner cap`)
    assert.equal(desktop, 150, `${placement} desktop height should be the canonical 150px`)
  }
})

test('top full-width banner heights descend mobile < tablet < desktop', () => {
  for (const placement of TOP_FULL_WIDTH_PLACEMENTS) {
    const mobile = getDisplayHeight(placement, 'mobile')
    const tablet = getDisplayHeight(placement, 'tablet')
    const desktop = getDisplayHeight(placement, 'desktop')
    assert.ok(mobile < tablet, `${placement} mobile ${mobile} should be smaller than tablet ${tablet}`)
    assert.ok(tablet < desktop, `${placement} tablet ${tablet} should be smaller than desktop ${desktop}`)
  }
})

test('no stale 200px desktop height rule wins for the top banner', () => {
  for (const placement of TOP_FULL_WIDTH_PLACEMENTS) {
    assert.notEqual(getDisplayHeight(placement, 'desktop'), 200, `${placement} must not use a stale 200px desktop height`)
  }
})

test('the slot is the single fixed-height owner for the top banner', () => {
  const layout = getAdvertisementLayout('HOMEPAGE_HERO')
  assert.ok(layout.slotClassName.includes('h-'), 'slot must own the banner height')
  assert.equal(layout.slotClassName.includes('h-[0'), false)
  assert.ok(layout.className.includes('max-w-'), 'slot remains full width bounded')
  assert.ok(layout.slotClassName.includes('lg:h-[150px]'), 'desktop slot height is the canonical 150px')
})

test('canonical top-banner display heights are exactly 90 mobile / 120 tablet / 150 desktop', () => {
  assert.deepEqual(FULL_WIDTH_BANNER_DISPLAY, { mobile: 90, tablet: 120, desktop: 150 })
  assert.equal(FULL_WIDTH_BANNER_DISPLAY.desktop, 150)
  assert.ok(FULL_WIDTH_BANNER_DISPLAY.mobile < FULL_WIDTH_BANNER_DISPLAY.tablet)
  assert.ok(FULL_WIDTH_BANNER_DISPLAY.tablet < FULL_WIDTH_BANNER_DISPLAY.desktop)
})

test('the top banner slot resolves to the literal, non-interpolated height classes', () => {
  for (const placement of TOP_FULL_WIDTH_PLACEMENTS) {
    const layout = getAdvertisementLayout(placement)
    const mobile = getDisplayHeight(placement, 'mobile')
    const tablet = getDisplayHeight(placement, 'tablet')
    const desktop = getDisplayHeight(placement, 'desktop')
    const expected = `h-[${mobile}px] sm:h-[${tablet}px] lg:h-[${desktop}px]`
    assert.equal(layout.slotClassName, expected, `${placement} must resolve to the literal height classes`)
    assert.equal(layout.slotClassName, 'h-[90px] sm:h-[120px] lg:h-[150px]', `${placement} desktop slot must be the canonical 150px strip`)
  }
})

test('ad-layout source keeps height classes as literals so Tailwind compiles them', () => {
  const layoutSourcePath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../components/advertisements/ad-layout.ts')
  const source = fs.readFileSync(layoutSourcePath, 'utf8')
  assert.ok(source.includes("'h-[90px] sm:h-[120px] lg:h-[150px]'"), 'top banner height classes must exist as literal strings in ad-layout.ts')
  assert.equal(source.includes('`h-[${mobile}px]'), false, 'slot height classes must not be built from template interpolation that Tailwind cannot scan')
})

test('every horizontal placement slot emits a literal height class with no interpolation', () => {
  for (const placement of Object.keys(AD_PLACEMENT_CONFIG)) {
    const config = AD_PLACEMENT_CONFIG[placement]
    if (config.popup) continue
    const mobile = getDisplayHeight(placement, 'mobile')
    const tablet = getDisplayHeight(placement, 'tablet')
    const desktop = getDisplayHeight(placement, 'desktop')
    assert.equal(config.slotClassName, `h-[${mobile}px] sm:h-[${tablet}px] lg:h-[${desktop}px]`, `${placement} slot height must be literal`)
    assert.ok(config.slotClassName.startsWith('h-['), placement)
    assert.ok(config.slotClassName.includes(`lg:h-[${desktop}px]`), `${placement} desktop height must be encoded in the slot class`)
  }
})

test('the top banner keeps the canonical 1600x300 / 16:3 horizontal creative contract', () => {
  const spec = getPlacementSpec('HOMEPAGE_HERO')
  assert.ok(spec)
  assert.equal(spec.formats[0], 'HORIZONTAL')
  const dims = getRequiredDimensions('HOMEPAGE_HERO', 'HORIZONTAL', 'desktop')
  assert.deepEqual({ width: dims.width, height: dims.height, aspectRatio: dims.aspectRatio }, { width: 1600, height: 300, aspectRatio: '16:3' })
})

test('admin placement info advertises the 150px maximum for the top banner', () => {
  const info = getPlacementInfo('HOMEPAGE_HERO')
  assert.ok(info)
  assert.equal(info.specs.maxDisplayHeight, 150)
  assert.equal(info.specs.recommendedWidth, 1600)
  assert.equal(info.specs.recommendedHeight, 300)
  assert.equal(info.specs.aspectRatio, '16:3')
  assert.ok(info.specs.displayHeight)
  assert.ok(info.specs.displayHeight.desktop <= 150)
  assert.equal(info.specs.displayHeight.desktop, 150)
})

test('non-top placements do not advertise a 150px top-banner ceiling', () => {
  for (const placement of ['FOOTER', 'ANNOUNCEMENT_TOP', 'ANNOUNCEMENT_BOTTOM', 'BROKER_LISTING_SIDEBAR', 'POPUP_OVERLAY', 'MOBILE_HEADER_BANNER']) {
    const info = getPlacementInfo(placement)
    assert.ok(info, placement)
    assert.equal(info.specs.maxDisplayHeight, undefined, `${placement} should not advertise the 150px top-banner cap`)
  }
})
