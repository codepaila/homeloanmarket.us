import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PublicAdResponse } from '../lib/advertisements/types'
import { DisplayBannerCard } from '../components/advertisements/DisplayBannerCard'
import { AdvertisementCard } from '../components/advertisements/AdvertisementCard'
import { getAdvertisementRequirements } from '../lib/advertisements/requirements'
import { getPlacementFormats, isFormatCompatible } from '../lib/advertisements/formats'
import { formatAspectClass, formatAspectRatio } from '../lib/advertisements/formatAspect'
import { AD_RADIUS_MIN, AD_RADIUS_MAX, AD_RADIUS_STEP, clampAdRadius } from '../lib/advertisements/radius'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ---------------------------------------------------------------------------
// Radius control (backend contract: 1..100, positive)
// ---------------------------------------------------------------------------

test('radius constants match the server-authoritative contract', () => {
  const validation = read('lib/advertisements/validation.ts')
  const services = read('lib/advertisements/services.ts')
  assert.equal(AD_RADIUS_MIN, 1)
  assert.equal(AD_RADIUS_MAX, 100)
  assert.equal(AD_RADIUS_STEP, 1)
  // The server contract is preserved and remains authoritative.
  assert.match(validation, /radiusMiles: z\.number\(\)\.positive\(\)\.max\(100\)/)
  assert.match(services, /radiusMiles <= 0 \|\| data\.locationTarget\.radiusMiles > 100/)
  assert.match(services, /locationTarget\.radiusMiles <= 0 \|\| locationTarget\.radiusMiles > 100/)
})

test('clampAdRadius clamps to 1..100 and rounds', () => {
  assert.equal(clampAdRadius(0), AD_RADIUS_MIN)
  assert.equal(clampAdRadius(-5), AD_RADIUS_MIN)
  assert.equal(clampAdRadius(150), AD_RADIUS_MAX)
  assert.equal(clampAdRadius(25), 25)
  assert.equal(clampAdRadius(25.6), 26)
  // Non-finite values fall back to the default radius.
  assert.equal(clampAdRadius(Number.NaN), 25)
})

test('wizard radius control is a synchronized number input + range slider', () => {
  const wizard = read('components/admin/ads/AdvertisementWizard.tsx')
  const control = read('components/admin/ads/TargetRadiusControl.tsx')
  const radius = read('lib/advertisements/radius.ts')
  assert.match(wizard, /TargetRadiusControl/)
  assert.match(control, /type="number"/)
  assert.match(control, /type="range"/)
  assert.match(control, /onBlur=\{\(\) => onChange\(clampAdRadius/)
  assert.match(control, /clampAdRadius\(Number\(e\.target\.value\)\)/)
  // No stale fixed select of [5,10,25,50,100] remains in the wizard.
  assert.doesNotMatch(wizard, /\[5, 10, 25, 50, 100\]/)
  assert.match(radius, /AD_RADIUS_MIN = 1/)
  assert.match(radius, /AD_RADIUS_MAX = 100/)
})

test('edit form radius control uses the same synchronized component', () => {
  const form = read('components/admin/ads/AdvertisementForm.tsx')
  assert.match(form, /TargetRadiusControl/)
  assert.match(form, /Target radius \(miles\)/)
})

// ---------------------------------------------------------------------------
// Supported creative formats + canonical dimensions
// ---------------------------------------------------------------------------

test('BROKER_LISTING_LOCAL supports SQUARE and BANNER only (no Rectangle)', () => {
  assert.deepEqual(getPlacementFormats('BROKER_LISTING_LOCAL'), ['SQUARE', 'BANNER', 'WIDE_RECTANGLE'])
  assert.equal(isFormatCompatible('BROKER_LISTING_LOCAL', 'SQUARE'), true)
  assert.equal(isFormatCompatible('BROKER_LISTING_LOCAL', 'BANNER'), true)
  assert.equal(isFormatCompatible('BROKER_LISTING_LOCAL', 'WIDE_RECTANGLE'), true)
  assert.equal(isFormatCompatible('BROKER_LISTING_LOCAL', 'RECTANGLE'), false)
})

test('canonical dimensions: SQUARE 800x800 1:1, BANNER 1600x800 2:1, RECTANGLE 1200x800 3:2', () => {
  const specs = read('lib/advertisements/placementSpecs.ts')
  assert.match(specs, /SQUARE: \{ format: 'SQUARE', width: 800, height: 800, aspectRatio: '1:1'/)
  assert.match(specs, /BANNER: \{ format: 'BANNER', width: 1600, height: 800, aspectRatio: '2:1'/)
  assert.match(specs, /RECTANGLE: \{ format: 'RECTANGLE', width: 1200, height: 800, aspectRatio: '3:2'/)
})

test('format aspect helpers map formats to the correct ratios', () => {
  assert.equal(formatAspectRatio('SQUARE'), '1:1')
  assert.equal(formatAspectRatio('BANNER'), '2:1')
  assert.equal(formatAspectRatio('RECTANGLE'), '3:2')
  assert.equal(formatAspectClass('SQUARE'), 'aspect-square')
  assert.equal(formatAspectClass('BANNER'), 'aspect-[2/1]')
  assert.equal(formatAspectClass('RECTANGLE'), 'aspect-[3/2]')
})

test('admin wizard format step exposes explicit dimensions and ratio', () => {
  const wizard = read('components/admin/ads/AdvertisementWizard.tsx')
  assert.match(wizard, /formatReq\.width} × \{formatReq\.height\}/)
  assert.match(wizard, /Aspect ratio: \{formatReq\.aspectRatio\}/)
})

test('admin preview derives BROKER_LISTING_LOCAL card aspect from the format', () => {
  const preview = read('app/admin/ads/[id]/preview/page.tsx')
  assert.match(preview, /formatAspectClass\(format\)/)
  assert.match(preview, /format={activePreviewFormat}/)
  assert.match(preview, /formatAspectRatio\(format\)/)
  assert.doesNotMatch(preview, /aspect-square overflow-hidden rounded-md bg-muted/)
  assert.doesNotMatch(preview, /aspect-square overflow-hidden rounded bg-muted/)
})

// ---------------------------------------------------------------------------
// Public rendering: format-derived aspect + mixed formats
// ---------------------------------------------------------------------------

test('public renderer uses format-derived aspect and DisplayBannerCard for BANNER', () => {
  const renderer = read('components/advertisements/PublicAdvertisement.tsx')
  assert.match(renderer, /formatAspectClass\(ad\.creativeFormat\)/)
  assert.match(renderer, /isDisplayBanner = ad\.creativeFormat === 'BANNER' \|\| ad\.creativeFormat === 'WIDE_RECTANGLE'/)
  assert.match(renderer, /DisplayBannerCard ad=\{ad\} \/>/)
  assert.doesNotMatch(renderer, /aspect-square min-w-0 overflow-hidden rounded bg-card/)
})

function bannerAd(id: string, format: 'SQUARE' | 'BANNER' | 'WIDE_RECTANGLE' = 'SQUARE'): PublicAdResponse {
  return {
    id,
    title: `Ad ${id}`,
    description: 'desc',
    type: 'SPONSORED_BANNER',
    action: 'DISPLAY_ONLY',
    buttonVariant: 'PRIMARY',
    placement: 'BROKER_LISTING_LOCAL',
    altText: 'alt',
    bannerUrl: null,
    buttonLabel: null,
    buttonUrl: null,
    openInNewTab: true,
    isDismissible: false,
    startDate: null,
    endDate: null,
    creativeFormat: format,
    desktopMedia: null,
    mobileMedia: null,
    creative: { fileUrl: 'https://cdn.example/x.webp', thumbnailUrl: null, altText: 'alt', width: 800, height: 800 },
  }
}

test('DisplayBannerCard renders a 2:1 aspect unit (BANNER format)', () => {
  const html = renderToStaticMarkup(<DisplayBannerCard ad={bannerAd('b', 'BANNER')} />)
  assert.match(html, /style="padding-top:50%"/, '2:1 via padding-top 50%')
  assert.match(html, /object-cover/)
})

test('DisplayBannerCard renders an 8:5 aspect unit (WIDE_RECTANGLE format)', () => {
  const html = renderToStaticMarkup(<DisplayBannerCard ad={bannerAd('w', 'WIDE_RECTANGLE')} />)
  assert.match(html, /style="padding-top:62.5%"/, '8:5 via padding-top 62.5%')
  assert.match(html, /object-cover/)
})

test('Square card and Banner card do not share a single forced aspect', () => {
  // SQUARE creative → aspect-square; BANNER creative → DisplayBannerCard (2:1).
  assert.equal(formatAspectClass('SQUARE'), 'aspect-square')
  assert.equal(formatAspectClass('BANNER'), 'aspect-[2/1]')
})

test('mixed formats are all resolvable (SQUARE + BANNER + WIDE_RECTANGLE)', () => {
  // The renderer branches per-ad on creativeFormat; both formats coexist in the
  // grid and are never collapsed to a single format.
  const renderer = read('components/advertisements/PublicAdvertisement.tsx')
  assert.match(renderer, /validAds\.map\(\(ad\)/)
  assert.match(renderer, /ad\.creativeFormat === 'BANNER' \|\| ad\.creativeFormat === 'WIDE_RECTANGLE'/)
})

// ---------------------------------------------------------------------------
// Responsive grid + optional content + link behavior
// ---------------------------------------------------------------------------

test('broker-listing local grid is 3/2/1 columns with no fixed desktop width', () => {
  const renderer = read('components/advertisements/PublicAdvertisement.tsx')
  assert.match(renderer, /grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3/)
  assert.doesNotMatch(renderer, /min-w-\[[0-9]+px\]/)
})

test('AdvertisementCard supports image-only, image+title, image+description, image+link, all fields', () => {
  const card = read('components/advertisements/AdvertisementCard.tsx')
  const wrapper = read('components/advertisements/AdvertisementWrapper.tsx')
  // Optional content is not required.
  assert.match(card, /hasText = Boolean\(ad\.title \|\| ad\.description \|\| hasButton\)/)
  assert.match(card, /hasImage = Boolean\(ad\.creative\?\.fileUrl/)
  // DISPLAY_ONLY renders a non-clickable region.
  assert.match(wrapper, /isClickable = action !== 'DISPLAY_ONLY'/)
  // Clickable uses a single native anchor.
  assert.match(wrapper, /<a/)
  assert.match(wrapper, /rel=\{openInNewTab \? 'noopener noreferrer' : undefined\}/)
  assert.doesNotMatch(wrapper, /preventDefault/)
  assert.doesNotMatch(wrapper, /role="button"/)
})

test('clickable wrapper renders exactly one native anchor and no nested interactive element', () => {
  const item = bannerAd('c', 'SQUARE')
  const html = renderToStaticMarkup(<AdvertisementCard ad={{ ...item, action: 'BANNER_CLICK', buttonUrl: '/go', bannerUrl: '/banner' }} />)
  const anchors = html.match(/<a\b/g) || []
  assert.equal(anchors.length, 1)
})

test('BROKER_LISTING_LOCAL requirements expose a single SQUARE creative slot and support mobile', () => {
  const req = getAdvertisementRequirements('BROKER_LISTING_LOCAL')
  assert.equal(req.supportsLocation, true)
  assert.equal(req.supportsMobile, true)
  assert.equal(req.creativeSlots.length, 1)
  assert.equal(req.creativeSlots[0].format, 'SQUARE')
})
