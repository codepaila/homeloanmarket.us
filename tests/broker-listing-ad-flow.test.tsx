import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PublicAdResponse } from '../lib/advertisements/types'
import { AdvertisementCard } from '../components/advertisements/AdvertisementCard'
import { AdvertisementWrapper } from '../components/advertisements/AdvertisementWrapper'
import { getAdvertisementRequirements } from '../lib/advertisements/requirements'
import { getPlacementFormats } from '../lib/advertisements/formats'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ---------------------------------------------------------------------------
// Admin creation: device targeting / creative contract for BROKER_LISTING_LOCAL
// ---------------------------------------------------------------------------

test('BROKER_LISTING_LOCAL supports mobile rendering (device visibility is not tied to a MOBILE format)', () => {
  const req = getAdvertisementRequirements('BROKER_LISTING_LOCAL')
  assert.equal(req.supportsLocation, true)
  assert.equal(req.supportsMobile, true, 'local ads must be visible on mobile without a MOBILE creative')
  assert.equal(req.creativeSlots.length, 1, 'exactly one creative slot (SQUARE)')
  assert.equal(req.creativeSlots[0].format, 'SQUARE')
  assert.equal(req.creativeSlots[0].width, 800)
  assert.equal(req.creativeSlots[0].height, 800)
})

test('SQUARE is the primary broker-listing local format and no MOBILE format is required', () => {
  assert.deepEqual(getPlacementFormats('BROKER_LISTING_LOCAL'), ['SQUARE', 'BANNER', 'WIDE_RECTANGLE'])
})

test('wizard defaults mobile visibility from the placement requirement (never silently disables mobile)', () => {
  const wizard = read('components/admin/ads/AdvertisementWizard.tsx')
  const requirements = read('lib/advertisements/requirements.ts')
  assert.match(wizard, /showMobile: req\.supportsMobile/)
  assert.match(requirements, /supportsMobile: hasMobileFormat \|\| placement === 'BROKER_LISTING_LOCAL'/)
})

// ---------------------------------------------------------------------------
// Public rendering: responsive 3 → 2 → 1 column card grid
// ---------------------------------------------------------------------------

test('broker-listing local public renderer uses a responsive card grid respecting format and no giant banner', () => {
  const renderer = read('components/advertisements/PublicAdvertisement.tsx')
  const aspect = read('lib/advertisements/formatAspect.ts')
  assert.match(renderer, /grid-cols-1.*sm:grid-cols-2.*lg:grid-cols-3/)
  assert.match(renderer, /formatAspectClass\(ad\.creativeFormat\)/)
  assert.match(renderer, /DisplayBannerCard/)
  assert.match(aspect, /case '1:1':/)
  assert.match(aspect, /case '2:1':/)
})

// ---------------------------------------------------------------------------
// Click / link behavior: native anchor, no nested interactive elements
// ---------------------------------------------------------------------------

function ad(id: string, action: string, overrides: Partial<PublicAdResponse> = {}): PublicAdResponse {
  return {
    id,
    title: `Advertisement ${id}`,
    description: 'A controlled public advertisement.',
    type: 'SECTION_BANNER',
    action,
    buttonVariant: 'PRIMARY',
    placement: 'BROKER_LISTING_LOCAL',
    altText: 'Advertisement',
    bannerUrl: 'https://example.com/banner',
    buttonLabel: null,
    buttonUrl: null,
    openInNewTab: true,
    isDismissible: false,
    startDate: null,
    endDate: null,
    creativeFormat: 'SQUARE',
    desktopMedia: null,
    mobileMedia: null,
    ...overrides,
  }
}

test('DISPLAY_ONLY advertisement renders a non-clickable region (no link)', () => {
  const html = renderToStaticMarkup(<AdvertisementWrapper ad={ad('disp', 'DISPLAY_ONLY')} className="h-full"><span>content</span></AdvertisementWrapper>)
  assert.match(html, /role="region"/)
  assert.equal(/<a\b/.test(html), false, 'DISPLAY_ONLY must not render an anchor')
})

test('clickable advertisement renders a single native anchor with the destination', () => {
  const item = ad('banner', 'BANNER_CLICK', { bannerUrl: 'https://example.com/target' })
  const html = renderToStaticMarkup(<AdvertisementWrapper ad={item} className="h-full"><span>content</span></AdvertisementWrapper>)
  assert.match(html, /<a[^>]*href="https:\/\/example\.com\/target"/)
  assert.match(html, /rel="noopener noreferrer"/)
  assert.equal(/role="button"/.test(html), false, 'wrapper must not be a role=button containing a link')
})

test('BUTTON_ONLY / BANNER_AND_BUTTON prefer the button URL', () => {
  const button = ad('btn', 'BUTTON_ONLY', { buttonUrl: '/brokers', buttonLabel: 'Get Started' })
  assert.match(renderToStaticMarkup(<AdvertisementWrapper ad={button} className="h-full"><span>x</span></AdvertisementWrapper>), /<a[^>]*href="\/brokers"/)
  const both = ad('both', 'BANNER_AND_BUTTON', { buttonUrl: '/apply', buttonLabel: 'Apply' })
  assert.match(renderToStaticMarkup(<AdvertisementWrapper ad={both} className="h-full"><span>x</span></AdvertisementWrapper>), /<a[^>]*href="\/apply"/)
})

test('advertisement with no link renders a non-clickable card (no broken CTA)', () => {
  const item = ad('nolink', 'BUTTON_ONLY', { buttonUrl: null, bannerUrl: null })
  const html = renderToStaticMarkup(<AdvertisementCard ad={item} />)
  assert.equal(/<a\b/.test(html), false, 'no destination means no anchor')
  assert.match(html, /role="region"/)
})

test('advertisement card never nests a link inside the clickable wrapper', () => {
  const item = ad('card', 'BANNER_AND_BUTTON', { buttonUrl: '/apply', buttonLabel: 'Apply Now' })
  const html = renderToStaticMarkup(<AdvertisementCard ad={item} />)
  const anchors = html.match(/<a\b/g) || []
  assert.equal(anchors.length, 1, 'exactly one anchor (the card link) — no nested interactive controls')
  assert.match(html, /Apply Now/)
})

test('click tracking is fire-and-forget: no preventDefault + async window.open popup', () => {
  const tracker = read('lib/advertisements/tracker.ts')
  const wrapper = read('components/advertisements/AdvertisementWrapper.tsx')
  assert.doesNotMatch(tracker, /window\.open/, 'tracker must not open the destination (native navigation handles it)')
  assert.doesNotMatch(wrapper, /preventDefault/, 'wrapper must not preventDefault native navigation')
  assert.match(tracker, /keepalive: true/, 'tracking request survives navigation')
})