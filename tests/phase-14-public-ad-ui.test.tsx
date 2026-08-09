import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PublicAdResponse } from '../lib/advertisements/types'
import { AdvertisementCarousel } from '../components/advertisements/AdvertisementCarousel'
import { AdvertisementCard } from '../components/advertisements/AdvertisementCard'
import { AD_PLACEMENT_CONFIG } from '../components/advertisements/ad-layout'

function ad(id: string): PublicAdResponse {
  return {
    id,
    title: `Advertisement ${id}`,
    description: 'A controlled public advertisement.',
    type: 'SECTION_BANNER',
    action: 'BANNER_CLICK',
    buttonVariant: 'PRIMARY',
    placement: 'HOMEPAGE_HERO',
    altText: 'Advertisement',
    bannerUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa',
    buttonLabel: null,
    buttonUrl: '/brokers',
    openInNewTab: false,
    isDismissible: false,
    startDate: null,
    endDate: null,
    creativeFormat: null,
    desktopMedia: null,
    mobileMedia: null,
  }
}

test('every seeded placement has a controlled responsive layout', () => {
  const placements = ['HOMEPAGE_HERO', 'BROKER_LISTING_SIDEBAR', 'BLOG_INLINE', 'FOOTER', 'ANNOUNCEMENT_TOP', 'POPUP_OVERLAY', 'MOBILE_HEADER_BANNER']
  for (const placement of placements) {
    assert.ok(AD_PLACEMENT_CONFIG[placement])
    assert.ok(AD_PLACEMENT_CONFIG[placement].slotClassName.includes('h-'))
    assert.ok(AD_PLACEMENT_CONFIG[placement].className.includes('max-w-'))
  }
})

test('one advertisement renders without carousel controls', () => {
  const html = renderToStaticMarkup(<AdvertisementCard ad={ad('one')} />)
  assert.ok(html.includes('Advertisement one'))
  assert.equal(html.includes('Previous advertisement'), false)
  assert.equal(html.includes('Next advertisement'), false)
})

test('multiple advertisements render accessible carousel controls', () => {
  const html = renderToStaticMarkup(<AdvertisementCarousel ads={[ad('one'), ad('two')]} contentClassName="aspect-[16/5]" />)
  assert.ok(html.includes('aria-roledescription="carousel"'))
  assert.ok(html.includes('Previous advertisement'))
  assert.ok(html.includes('Next advertisement'))
  assert.ok(html.includes('Show advertisement 1'))
  assert.ok(html.includes('Show advertisement 2'))
  assert.ok(html.includes('max-w-full'))
})
