import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PublicAdResponse } from '../lib/advertisements/types'
import { isValidPublicAd, filterValidPublicAds } from '../lib/advertisements/public'
import { AdvertisementCard } from '../components/advertisements/AdvertisementCard'
import { AdvertisementCarousel } from '../components/advertisements/AdvertisementCarousel'

function ad(id: string, action = 'BANNER_CLICK' as string, overrides: Partial<PublicAdResponse> = {}): PublicAdResponse {
  return {
    id,
    title: `Advertisement ${id}`,
    description: 'A controlled public advertisement.',
    type: 'SECTION_BANNER',
    action,
    buttonVariant: 'PRIMARY',
    placement: 'HOMEPAGE_HERO',
    altText: 'Advertisement',
    bannerUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa',
    buttonLabel: null,
    buttonUrl: null,
    openInNewTab: false,
    isDismissible: false,
    startDate: null,
    endDate: null,
    creativeFormat: null,
    desktopMedia: null,
    mobileMedia: null,
    ...overrides,
  }
}

test('undefined advertisement does not crash AdvertisementCard', () => {
  const html = renderToStaticMarkup(<AdvertisementCard ad={undefined} />)
  assert.equal(html, '')
})

test('null advertisement does not crash AdvertisementCard', () => {
  const html = renderToStaticMarkup(<AdvertisementCard ad={null} />)
  assert.equal(html, '')
})

test('malformed advertisement object does not crash AdvertisementCard', () => {
  const malformed = { id: 'x', title: 'no action' } as unknown as PublicAdResponse
  assert.equal(isValidPublicAd(malformed), false)
  const html = renderToStaticMarkup(<AdvertisementCard ad={malformed} />)
  assert.equal(html, '')
})

test('valid DISPLAY_ONLY (image-only) advertisement still renders', () => {
  const html = renderToStaticMarkup(<AdvertisementCard ad={ad('display', 'DISPLAY_ONLY')} />)
  assert.ok(html.includes('Advertisement display'))
  assert.ok(html.includes('max-w-full'))
})

test('valid BUTTON_ONLY advertisement renders a button', () => {
  const item = ad('button', 'BUTTON_ONLY', { buttonLabel: 'Get Started', buttonUrl: '/brokers' })
  const html = renderToStaticMarkup(<AdvertisementCard ad={item} />)
  assert.ok(html.includes('Get Started'))
  assert.ok(html.includes('/brokers'))
})

test('valid BANNER_AND_BUTTON advertisement renders image and button', () => {
  const item = ad('both', 'BANNER_AND_BUTTON', { buttonLabel: 'Explore', buttonUrl: '/brokers' })
  const html = renderToStaticMarkup(<AdvertisementCard ad={item} />)
  assert.ok(html.includes('Explore'))
  assert.ok(html.includes('/brokers'))
})

test('valid BANNER_CLICK (banner-only) advertisement renders image without a button', () => {
  const html = renderToStaticMarkup(<AdvertisementCard ad={ad('banner', 'BANNER_CLICK')} />)
  assert.ok(html.includes('Advertisement banner'))
  assert.equal(html.includes('bg-primary px-3 py-1.5'), false)
})

test('valid DISPLAY_ONLY image-only advertisement with no title, description, or button renders safely', () => {
  const item = ad('imgonly', 'DISPLAY_ONLY', { title: '', description: null, buttonLabel: null, buttonUrl: null })
  const html = renderToStaticMarkup(<AdvertisementCard ad={item} />)
  assert.ok(html.includes('max-w-full'))
  assert.equal(html.includes('bg-primary px-3 py-1.5'), false)
})

test('advertisement with no image and no text renders nothing', () => {
  const item = ad('empty', 'DISPLAY_ONLY', { title: '', description: null, buttonLabel: null, buttonUrl: null, bannerUrl: null })
  const html = renderToStaticMarkup(<AdvertisementCard ad={item} />)
  assert.equal(html, '')
})

test('malformed API payload is sanitized before reaching the renderer', () => {
  const payload = {
    success: true,
    ads: [ad('good'), null, undefined, { id: 'x', title: 'No action' }, 'string', 42, ad('other', 'BUTTON_ONLY', { buttonLabel: 'Go', buttonUrl: '/brokers' })],
  } as unknown as { success: boolean; ads: unknown[] }
  const sanitized = filterValidPublicAds(payload.ads)
  assert.equal(sanitized.length, 2)
  assert.equal(sanitized[0].id, 'good')
  assert.equal(sanitized[1].id, 'other')
  const html = renderToStaticMarkup(<AdvertisementCard ad={sanitized[1]} />)
  assert.ok(html.includes('Go'))
  assert.ok(html.includes('/brokers'))
})

test('carousel filters invalid and undefined items without crashing', () => {
  const invalid = { id: 'bad', title: 'Bad ad', action: 'NOT_A_REAL_ACTION' } as unknown as PublicAdResponse
  const html = renderToStaticMarkup(
    <AdvertisementCarousel
      ads={[ad('one'), invalid, undefined as unknown as PublicAdResponse, null as unknown as PublicAdResponse, ad('two')]}
      contentClassName="aspect-[16/5]"
    />
  )
  assert.ok(html.includes('Advertisement one'))
  assert.ok(html.includes('Advertisement two'))
  assert.ok(html.includes('Show advertisement 1'))
  assert.ok(html.includes('Show advertisement 2'))
  assert.equal(html.includes('Advertisement bad'), false)
})

test('carousel renders nothing when all items are invalid', () => {
  const html = renderToStaticMarkup(
    <AdvertisementCarousel
      ads={[null as unknown as PublicAdResponse, undefined as unknown as PublicAdResponse]}
      contentClassName="aspect-[16/5]"
    />
  )
  assert.equal(html, '')
})

test('filterValidPublicAds removes malformed API advertisements', () => {
  const malformed = [{ id: 'x', title: 'No action' }, 'string', 42, null, undefined, ad('good')]
  const filtered = filterValidPublicAds(malformed as unknown as PublicAdResponse[])
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, 'good')
})

test('filterValidPublicAds rejects a non-array payload', () => {
  const filtered = filterValidPublicAds({ success: true, ads: [ad('nested')] })
  assert.equal(filtered.length, 0)
})

test('isValidPublicAd accepts every documented advertisement action', () => {
  for (const action of ['DISPLAY_ONLY', 'BANNER_CLICK', 'BUTTON_ONLY', 'BANNER_AND_BUTTON']) {
    assert.equal(isValidPublicAd(ad(action, action)), true, action)
  }
})
