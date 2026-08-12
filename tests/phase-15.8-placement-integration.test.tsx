import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { getDisplayHeight, getPlacementSpec, FULL_WIDTH_BANNER_DISPLAY } from '../lib/advertisements/placementSpecs'
import { getAdvertisementLayout } from '../components/advertisements/ad-layout'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

function countPlacementMounts(source: string, placement: string): number {
  const pattern = new RegExp(`AdvertisementRenderer[\\s\\S]{0,120}?placement\\s*=\\s*["']${placement}["']`, 'g')
  return (source.match(pattern) || []).length
}

const PUBLIC_LAYOUT_CHAIN = [
  'app/(public)/layout.tsx',
  'components/layout/index.tsx',
  'components/layout/Header.tsx',
  'components/layout/Footer.tsx',
]

test('the public layout chain has no general public advertisement mounts', () => {
  const totalMounts = PUBLIC_LAYOUT_CHAIN
    .map((file) => ['ANNOUNCEMENT_TOP', 'ANNOUNCEMENT_BOTTOM', 'POPUP_OVERLAY', 'MOBILE_HEADER_BANNER', 'FOOTER']
      .reduce((sum, placement) => sum + countPlacementMounts(read(file), placement), 0))
    .reduce((sum, count) => sum + count, 0)
  assert.equal(totalMounts, 0, 'general public pages must not mount advertisements')
})

test('the broker listing keeps only the local-resource advertisement mount', () => {
  const source = read('app/(public)/brokers/page.tsx')
  assert.equal(countPlacementMounts(source, 'BROKER_LISTING'), 0)
  assert.equal(countPlacementMounts(source, 'BROKER_LISTING_LOCAL'), 1)
})

test('general layout placements remain unmounted', () => {
  for (const placement of ['ANNOUNCEMENT_TOP', 'ANNOUNCEMENT_BOTTOM', 'POPUP_OVERLAY', 'MOBILE_HEADER_BANNER', 'FOOTER']) {
    const totalMounts = PUBLIC_LAYOUT_CHAIN
      .map((file) => countPlacementMounts(read(file), placement))
      .reduce((sum, count) => sum + count, 0)
    assert.equal(totalMounts, 0, `${placement} must not be mounted in the public layout chain`)
  }
})

test('configured-but-unused placements are intentionally not mounted', () => {
  const unused = ['HOMEPAGE_SEARCH', 'HOMEPAGE_SERVICES', 'HOMEPAGE_BANKS', 'BROKER_LISTING_SIDEBAR']
  const surfaceFiles = [
    'app/(public)/page.tsx',
    'app/(public)/layout.tsx',
    'app/(public)/brokers/page.tsx',
    'app/(public)/calculator/page.tsx',
    'app/(public)/blog/page.tsx',
    'app/(public)/blog/[slug]/page.tsx',
    'app/(public)/guides/page.tsx',
    'components/layout/index.tsx',
    'components/layout/Header.tsx',
    'components/layout/Footer.tsx',
    'components/sections/broker/BrokerDetailClient.tsx',
  ]
  for (const placement of unused) {
    assert.ok(getPlacementSpec(placement), `${placement} must remain a configured placement`)
    const mounted = surfaceFiles.some((file) => countPlacementMounts(read(file), placement) > 0)
    assert.equal(mounted, false, `${placement} must remain intentionally un-mounted (configured-but-unused)`)
  }
})

test('canonical announcement heights remain 50 / 60 / 70', () => {
  for (const placement of ['ANNOUNCEMENT_TOP', 'ANNOUNCEMENT_BOTTOM']) {
    assert.equal(getDisplayHeight(placement, 'mobile'), 50, placement)
    assert.equal(getDisplayHeight(placement, 'tablet'), 60, placement)
    assert.equal(getDisplayHeight(placement, 'desktop'), 70, placement)
    assert.equal(getAdvertisementLayout(placement).slotClassName, 'h-[50px] sm:h-[60px] lg:h-[70px]', placement)
  }
})

test('canonical footer heights remain 60 / 70 / 80', () => {
  assert.equal(getDisplayHeight('FOOTER', 'mobile'), 60)
  assert.equal(getDisplayHeight('FOOTER', 'tablet'), 70)
  assert.equal(getDisplayHeight('FOOTER', 'desktop'), 80)
  assert.equal(getAdvertisementLayout('FOOTER').slotClassName, 'h-[60px] sm:h-[70px] lg:h-[80px]')
})

test('full-width banner heights remain 90 / 120 / 150', () => {
  assert.deepEqual(FULL_WIDTH_BANNER_DISPLAY, { mobile: 90, tablet: 120, desktop: 150 })
  for (const placement of ['HOMEPAGE_HERO', 'HOMEPAGE_FEATURED', 'BROKER_LISTING', 'BLOG_INLINE', 'LOAN_CALCULATOR']) {
    assert.equal(getDisplayHeight(placement, 'mobile'), 90, placement)
    assert.equal(getDisplayHeight(placement, 'tablet'), 120, placement)
    assert.equal(getDisplayHeight(placement, 'desktop'), 150, placement)
    assert.equal(getAdvertisementLayout(placement).slotClassName, 'h-[90px] sm:h-[120px] lg:h-[150px]', placement)
  }
})

test('no admin-configurable height field exists in the advertisement form', () => {
  const formSource = read('components/admin/ads/AdvertisementForm.tsx')
  const validationSource = read('lib/advertisements/validation.ts')

  assert.equal(/name=["']height["']|\.height\b.*FormField|FormField[^]*?name=["']height/.test(formSource), false, 'form must not contain a height field')
  assert.equal(formSource.includes('customHeight') || formSource.includes('bannerHeight'), false, 'no custom height field')
  assert.equal(validationSource.includes('height:'), false, 'create/update schema must not persist a height field')

  assert.ok(formSource.includes('Display Height'), 'read-only Display Height guidance must remain')
  assert.ok(formSource.includes('Maximum Displayed Height'), 'read-only maximum height guidance must remain')
})

test('AdvertisementWrapper calls its tracking hooks before any early return (Rules of Hooks)', () => {
  const source = read('components/advertisements/AdvertisementWrapper.tsx')
  const hookIndex = Math.min(
    source.indexOf('useImpressionTracker('),
    source.indexOf('useClickTracker('),
  )
  const guardIndex = source.indexOf('return null')
  assert.notEqual(hookIndex, -1, 'wrapper must call impression tracker')
  assert.notEqual(guardIndex, -1, 'wrapper must keep a null guard for invalid ads')
  assert.ok(hookIndex !== -1 && hookIndex < guardIndex, 'hooks must be invoked before the null guard so hook order is stable')
  assert.ok(source.includes('useImpressionTracker(adId, isValid)'), 'impression tracking must be disabled for invalid ads')
})

test('uploaded creative dimensions cannot control the rendered slot height', () => {
  for (const placement of Object.keys(getAdvertisementLayout('HOMEPAGE_HERO') ? { HOMEPAGE_HERO: true, FOOTER: true, ANNOUNCEMENT_TOP: true, BROKER_LISTING_SIDEBAR: true } : {})) {
    const layout = getAdvertisementLayout(placement)
    assert.match(layout.slotClassName, /^h-\[\d+px\] sm:h-\[\d+px\] lg:h-\[\d+px\]$/, `${placement} must use a fixed, canonical literal slot height`)
    assert.equal(layout.slotClassName.includes('aspect'), false, `${placement} must not be aspect-ratio driven`)
  }

  const imageSource = read('components/advertisements/AdvertisementImage.tsx')
  assert.ok(imageSource.includes('object-contain'), 'creative must stay object-contain inside the fixed slot')
  const rendererSource = read('components/advertisements/PublicAdvertisement.tsx')
  assert.ok(rendererSource.includes('overflow-hidden'), 'slot must stay overflow-hidden')
  assert.ok(rendererSource.includes('h-full w-full'), 'image fills the bounded slot only')
})
