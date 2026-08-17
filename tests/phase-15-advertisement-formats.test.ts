import assert from 'node:assert/strict'
import test from 'node:test'
import { getFormatFallbackOrder, isFormatCompatible } from '../lib/advertisements/formats'
import { validateCreativeDimensions } from '../lib/advertisements/placementSpecs'
import { resolveAdvertisementCreative } from '../lib/advertisements/creativeResolver'
import { CreateAdSchema } from '../lib/advertisements/validation'

const media = (fileUrl: string, width = 1200, height = 400) => ({ fileUrl, thumbnailUrl: null, altText: 'Creative', width, height })

test('format compatibility maps semantic formats to real placements', () => {
  assert.equal(isFormatCompatible('HOMEPAGE_HERO', 'HORIZONTAL'), true)
  assert.equal(isFormatCompatible('BROKER_LISTING_SIDEBAR', 'VERTICAL'), true)
  assert.equal(isFormatCompatible('HOMEPAGE_HERO', 'VERTICAL'), false)
  assert.equal(validateCreativeDimensions('HOMEPAGE_FEATURED', 'SQUARE', 800, 800).ok, true)
  assert.equal(validateCreativeDimensions('BROKER_LISTING_SIDEBAR', 'VERTICAL', 800, 1200).ok, true)
  assert.equal(validateCreativeDimensions('HOMEPAGE_HERO', 'HORIZONTAL', 800, 1200).ok, false)
})

test('creative resolution prefers exact format then compatible fallback', () => {
  const resolved = resolveAdvertisementCreative({
    placement: 'HOMEPAGE_HERO',
    device: 'desktop',
    creatives: [
      { format: 'RECTANGLE', mediaAsset: media('/rectangle.webp', 1200, 800) },
      { format: 'HORIZONTAL', mediaAsset: media('/horizontal.webp') },
    ],
    bannerUrl: '/legacy.webp',
  })
  assert.equal(resolved.format, 'HORIZONTAL')
  assert.equal(resolved.media?.fileUrl, '/horizontal.webp')
})

test('mobile resolution prefers mobile creative and falls back deterministically', () => {
  const mobile = resolveAdvertisementCreative({
    placement: 'HOMEPAGE_HERO',
    device: 'mobile',
    creatives: [{ format: 'MOBILE', mediaAsset: media('/mobile.webp', 750, 400) }],
    desktopMedia: media('/desktop.webp'),
  })
  assert.equal(mobile.format, 'MOBILE')
  assert.equal(mobile.media?.fileUrl, '/mobile.webp')

  const legacy = resolveAdvertisementCreative({ placement: 'HOMEPAGE_HERO', device: 'desktop', desktopMedia: media('/legacy.webp') })
  assert.equal(legacy.media?.fileUrl, '/legacy.webp')
  assert.equal(getFormatFallbackOrder('HOMEPAGE_HERO', true)[0], 'MOBILE')
})

test('creative assignment validation rejects duplicate formats', () => {
  const result = CreateAdSchema.safeParse({
    title: 'Format test', placement: 'HOMEPAGE_HERO', type: 'HERO_BANNER', action: 'DISPLAY_ONLY',
    creativeAssignments: [
      { mediaAssetId: 'asset-1', format: 'HORIZONTAL' },
      { mediaAssetId: 'asset-2', format: 'HORIZONTAL' },
    ],
  })
  assert.equal(result.success, false)
})
