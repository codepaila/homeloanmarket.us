import assert from 'node:assert/strict'
import test from 'node:test'
import prisma from '../lib/prisma'
import { AdvertisementService } from '../lib/advertisements/services'

// Real-data verification of the CRITICAL created-ad → broker-listing path.
// A BROKER_LISTING_LOCAL advertisement created through the admin wizard (which
// does not attach a company) must render for an in-radius search location.
async function makeUser(suffix: string) {
  return prisma.user.create({ data: { name: 'Audit', email: 'audit' + suffix + '@example.com', role: 'USER', isActive: true } })
}
async function makeSquareMedia(userId: string, suffix: string) {
  return prisma.mediaAsset.create({ data: { fileName: 'sq-' + suffix + '.webp', originalName: 'square.webp', fileUrl: '/uploads/sq-' + suffix + '.webp', mimeType: 'image/webp', extension: 'webp', fileSize: 100, width: 800, height: 800, uploaderId: userId, isDeleted: false } })
}
async function makeBannerMedia(userId: string, suffix: string) {
  return prisma.mediaAsset.create({ data: { fileName: 'bn-' + suffix + '.webp', originalName: 'banner.webp', fileUrl: '/uploads/bn-' + suffix + '.webp', mimeType: 'image/webp', extension: 'webp', fileSize: 100, width: 1600, height: 800, uploaderId: userId, isDeleted: false } })
}

test('created BROKER_LISTING_LOCAL ad (no company) renders inside radius and is hidden outside', async () => {
  const suffix = Date.now() + '-' + Math.floor(Math.random() * 1e6)
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined
  try {
    const user = await makeUser(suffix)
    userId = user.id
    const media = await makeSquareMedia(user.id, suffix)
    mediaId = media.id

    // Mirror the admin wizard: no company, enabled, SQUARE creative, Dallas target.
    const ad = await AdvertisementService.create({
      title: 'Audit Dallas ' + suffix,
      placement: 'BROKER_LISTING_LOCAL',
      type: 'SPONSORED_BANNER',
      action: 'DISPLAY_ONLY',
      isEnabled: true,
      showDesktop: true,
      showTablet: true,
      showMobile: true,
      priority: 10,
      displayOrder: 0,
      createdById: user.id,
      creativeAssignments: [{ mediaAssetId: media.id, format: 'SQUARE' }],
      locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
    })
    adId = ad.id

    const dallas = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.797 })
    assert.ok(dallas.some((a) => a.id === ad.id), 'company-less local ad must render for in-radius Dallas')

    const houston = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 29.7604, longitude: -95.3698 })
    assert.equal(houston.some((a) => a.id === ad.id), false, 'ad must be hidden for out-of-radius Houston')

    // No location → radius ads must not become global.
    const noLocation = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date())
    assert.equal(noLocation.some((a) => a.id === ad.id), false, 'local ad must not render without a search location')

    // Disabled / expired / archived must hide it.
    await prisma.advertisement.update({ where: { id: ad.id }, data: { isEnabled: false } })
    assert.equal((await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.797 })).some((a) => a.id === ad.id), false, 'disabled ad hidden')
    await prisma.advertisement.update({ where: { id: ad.id }, data: { isEnabled: true, endDate: new Date(Date.now() - 1000) } })
    assert.equal((await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.797 })).some((a) => a.id === ad.id), false, 'expired ad hidden')
    await prisma.advertisement.update({ where: { id: ad.id }, data: { endDate: null, isArchived: true } })
    assert.equal((await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.797 })).some((a) => a.id === ad.id), false, 'archived ad hidden')
  } finally {
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('BROKER_LISTING_LOCAL requires a SQUARE or BANNER creative at creation time', async () => {
  const suffix = Date.now() + '-' + Math.floor(Math.random() * 1e6)
  let userId: string | undefined
  try {
    const user = await makeUser(suffix)
    userId = user.id
    await assert.rejects(
      () => AdvertisementService.create({
        title: 'No Creative ' + suffix,
        placement: 'BROKER_LISTING_LOCAL',
        type: 'SPONSORED_BANNER',
        action: 'DISPLAY_ONLY',
        isEnabled: true,
        createdById: user.id,
        creativeAssignments: [],
        locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
      }),
      /require a SQUARE, BANNER, or WIDE_RECTANGLE creative/,
      'BROKER_LISTING_LOCAL must reject an ad without a SQUARE or BANNER creative',
    )
  } finally {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('advertisement title is optional end-to-end', async () => {
  const suffix = Date.now() + '-' + Math.floor(Math.random() * 1e6)
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined
  try {
    const user = await makeUser(suffix)
    userId = user.id
    const media = await makeSquareMedia(user.id, suffix)
    mediaId = media.id

    const ad = await AdvertisementService.create({
      title: undefined,
      placement: 'BROKER_LISTING_LOCAL',
      type: 'SPONSORED_BANNER',
      action: 'DISPLAY_ONLY',
      isEnabled: true,
      showDesktop: true,
      showTablet: true,
      showMobile: true,
      priority: 10,
      displayOrder: 0,
      createdById: user.id,
      creativeAssignments: [{ mediaAssetId: media.id, format: 'SQUARE' }],
      locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
    })
    adId = ad.id
    assert.ok(ad.id, 'ad creation must succeed without a title')
    const stored = await prisma.advertisement.findUnique({ where: { id: ad.id }, select: { title: true, slug: true } })
    assert.equal(stored?.title, null, 'title must persist as null')
    assert.ok(stored?.slug, 'a slug must still be generated')

    // The ad must still be eligible for rendering (title is not required to show).
    const dallas = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.797 })
    assert.ok(dallas.some((a) => a.id === ad.id), 'untitled ad must still render')
  } finally {
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('created BROKER_LISTING_LOCAL BANNER ad renders inside radius and is hidden outside', async () => {
  const suffix = Date.now() + '-' + Math.floor(Math.random() * 1e6)
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined
  try {
    const user = await makeUser(suffix)
    userId = user.id
    const media = await makeBannerMedia(user.id, suffix)
    mediaId = media.id

    const ad = await AdvertisementService.create({
      title: 'Audit Dallas Banner ' + suffix,
      placement: 'BROKER_LISTING_LOCAL',
      type: 'SPONSORED_BANNER',
      action: 'BANNER_AND_BUTTON',
      isEnabled: true,
      showDesktop: true,
      showTablet: true,
      showMobile: true,
      priority: 10,
      displayOrder: 0,
      createdById: user.id,
      creativeAssignments: [{ mediaAssetId: media.id, format: 'BANNER' }],
      locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
    })
    adId = ad.id

    const dallas = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.797 })
    assert.ok(dallas.some((a) => a.id === ad.id), 'BANNER local ad must render for in-radius Dallas')
    assert.equal(dallas.find((a) => a.id === ad.id)?.creativeFormat, 'BANNER', 'creative format must be reported as BANNER')

    const houston = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 29.7604, longitude: -95.3698 })
    assert.equal(houston.some((a) => a.id === ad.id), false, 'BANNER ad must be hidden for out-of-radius Houston')

    // Plano is ~20 miles from Dallas, so it is inside a 25-mile radius.
    const plano = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 33.0198, longitude: -96.6989 })
    assert.ok(plano.some((a) => a.id === ad.id), 'BANNER ad must render for nearby in-radius Plano')

    // No location → local banner ads must not become global.
    const noLocation = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date())
    assert.equal(noLocation.some((a) => a.id === ad.id), false, 'local BANNER ad must not render without a search location')

    // Disabled / expired / archived must hide it.
    await prisma.advertisement.update({ where: { id: ad.id }, data: { isEnabled: false } })
    assert.equal((await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.797 })).some((a) => a.id === ad.id), false, 'disabled BANNER ad hidden')
    await prisma.advertisement.update({ where: { id: ad.id }, data: { isEnabled: true, endDate: new Date(Date.now() - 1000) } })
    assert.equal((await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.797 })).some((a) => a.id === ad.id), false, 'expired BANNER ad hidden')
    await prisma.advertisement.update({ where: { id: ad.id }, data: { endDate: null, isArchived: true } })
    assert.equal((await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.797 })).some((a) => a.id === ad.id), false, 'archived BANNER ad hidden')
  } finally {
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('BROKER_LISTING_LOCAL rejects an incompatible RECTANGLE creative', async () => {
  const suffix = Date.now() + '-' + Math.floor(Math.random() * 1e6)
  let userId: string | undefined, mediaId: string | undefined
  try {
    const user = await makeUser(suffix)
    userId = user.id
    const media = await makeSquareMedia(user.id, suffix)
    mediaId = media.id
    await assert.rejects(
      () => AdvertisementService.create({
        title: 'Wrong Creative ' + suffix,
        placement: 'BROKER_LISTING_LOCAL',
        type: 'SPONSORED_BANNER',
        action: 'DISPLAY_ONLY',
        isEnabled: true,
        createdById: user.id,
        creativeAssignments: [{ mediaAssetId: media.id, format: 'RECTANGLE' }],
        locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
      }),
      /require a SQUARE, BANNER, or WIDE_RECTANGLE creative/,
      'BROKER_LISTING_LOCAL must reject a RECTANGLE creative',
    )
  } finally {
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})
