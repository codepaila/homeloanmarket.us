import assert from 'node:assert/strict'
import test from 'node:test'
import prisma from '../lib/prisma'
import { AdvertisementService } from '../lib/advertisements/services'
import { normalizeAdvertisementTitle } from '../lib/advertisements/utils'

const suffix = () => Date.now() + '-' + Math.floor(Math.random() * 1e6)

async function makeUser(tag: string) {
  return prisma.user.create({ data: { name: 'Audit', email: tag + '@example.com', role: 'USER', isActive: true } })
}
async function makeSquareMedia(userId: string, tag: string) {
  return prisma.mediaAsset.create({ data: { fileName: 'sq-' + tag + '.webp', originalName: 'square.webp', fileUrl: '/uploads/sq-' + tag + '.webp', mimeType: 'image/webp', extension: 'webp', fileSize: 100, width: 800, height: 800, uploaderId: userId, isDeleted: false } })
}
async function makeCompany(tag: string) {
  const company = await prisma.company.create({ data: { name: 'Audit Co ' + tag, type: 'HOME_LOAN_COMPANY', address: '1 Main', contactName: 'A', contactPosition: 'Mgr', phone: '+1', bannerAddress: 'x', bannerPhone: '+1', status: 'ACTIVE', onboardedAt: new Date() } })
  const plan = await prisma.companyAdvertisingPlan.create({ data: { name: 'Audit Plan ' + tag, price: 10, billingInterval: 'month', isActive: true, stripeProductId: 'p-' + tag, stripePriceId: 'pr-' + tag } })
  await prisma.companySubscription.create({ data: { companyId: company.id, plan: 'ADVERTISING', planId: plan.id, status: 'ACTIVE', isActive: true } })
  return { company, plan }
}

test('normalizeAdvertisementTitle contract', () => {
  assert.equal(normalizeAdvertisementTitle(undefined), undefined)
  assert.equal(normalizeAdvertisementTitle(null), null)
  assert.equal(normalizeAdvertisementTitle(''), null)
  assert.equal(normalizeAdvertisementTitle('   '), null)
  assert.equal(normalizeAdvertisementTitle('  Real Title  '), 'Real Title')
})

test('title clear: edit existing title to empty persists NULL and survives reload', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined
  try {
    const user = await makeUser('clear' + tag)
    userId = user.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id

    const ad = await AdvertisementService.create({
      title: 'John\'s Mortgage Ad',
      placement: 'BROKER_LISTING_LOCAL',
      type: 'SPONSORED_BANNER',
      action: 'DISPLAY_ONLY',
      isEnabled: true,
      createdById: user.id,
      creativeAssignments: [{ mediaAssetId: media.id, format: 'SQUARE' }],
      locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
    })
    adId = ad.id
    assert.equal((await prisma.advertisement.findUnique({ where: { id: ad.id } }))?.title, 'John\'s Mortgage Ad')

    // Admin clears the title → the edit form submits title: "".
    await AdvertisementService.update(ad.id, { title: '' })
    const afterClear = await prisma.advertisement.findUnique({ where: { id: ad.id } })
    assert.equal(afterClear?.title, null, 'empty title must clear to NULL')

    // Reload (re-fetch) → still null.
    const reloaded = await AdvertisementService.getById(ad.id)
    assert.equal(reloaded?.title, null, 'title stays cleared after reload')
  } finally {
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('title set: update to a new title persists', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined
  try {
    const user = await makeUser('set' + tag)
    userId = user.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id
    const ad = await AdvertisementService.create({
      title: 'Old Title',
      placement: 'BROKER_LISTING_LOCAL',
      type: 'SPONSORED_BANNER',
      action: 'DISPLAY_ONLY',
      isEnabled: true,
      createdById: user.id,
      creativeAssignments: [{ mediaAssetId: media.id, format: 'SQUARE' }],
      locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
    })
    adId = ad.id
    await AdvertisementService.update(ad.id, { title: 'New Title' })
    assert.equal((await prisma.advertisement.findUnique({ where: { id: ad.id } }))?.title, 'New Title')
  } finally {
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('title omitted: PATCH without title preserves the existing title', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined
  try {
    const user = await makeUser('omit' + tag)
    userId = user.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id
    const ad = await AdvertisementService.create({
      title: 'Keep Me',
      placement: 'BROKER_LISTING_LOCAL',
      type: 'SPONSORED_BANNER',
      action: 'DISPLAY_ONLY',
      isEnabled: true,
      createdById: user.id,
      creativeAssignments: [{ mediaAssetId: media.id, format: 'SQUARE' }],
      locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
    })
    adId = ad.id
    await AdvertisementService.update(ad.id, { isEnabled: false })
    assert.equal((await prisma.advertisement.findUnique({ where: { id: ad.id } }))?.title, 'Keep Me', 'omitted title must be preserved')
  } finally {
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('create without title succeeds with NULL title and a valid unique slug', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined
  try {
    const user = await makeUser('noTitle' + tag)
    userId = user.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id
    const ad = await AdvertisementService.create({
      title: undefined,
      placement: 'BROKER_LISTING_LOCAL',
      type: 'SPONSORED_BANNER',
      action: 'DISPLAY_ONLY',
      isEnabled: true,
      createdById: user.id,
      creativeAssignments: [{ mediaAssetId: media.id, format: 'SQUARE' }],
      locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
    })
    adId = ad.id
    const stored = await prisma.advertisement.findUnique({ where: { id: ad.id } })
    assert.equal(stored?.title, null)
    assert.ok(stored?.slug && stored.slug.length > 0, 'slug must be generated')
  } finally {
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('duplicate titled ad: new id, unique slug, original untouched', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined, dupId: string | undefined
  try {
    const user = await makeUser('dup' + tag)
    userId = user.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id
    const ad = await AdvertisementService.create({
      title: 'Original Campaign',
      placement: 'BROKER_LISTING_LOCAL',
      type: 'SPONSORED_BANNER',
      action: 'DISPLAY_ONLY',
      isEnabled: true,
      createdById: user.id,
      creativeAssignments: [{ mediaAssetId: media.id, format: 'SQUARE' }],
      locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
    })
    adId = ad.id
    const originalBefore = await prisma.advertisement.findUnique({ where: { id: ad.id }, include: { creatives: true, locationTarget: true } })

    const dup = await AdvertisementService.duplicate(ad.id, { title: 'Original Campaign (Copy)', createdById: user.id })
    dupId = dup.id

    assert.notEqual(dup.id, ad.id, 'duplicate must have a new id')
    assert.notEqual(dup.slug, originalBefore?.slug, 'duplicate must have a new slug')
    assert.equal(dup.title, 'Original Campaign (Copy)')

    const originalAfter = await prisma.advertisement.findUnique({ where: { id: ad.id }, include: { creatives: true, locationTarget: true } })
    assert.equal(originalAfter?.title, 'Original Campaign', 'original title must not change')
    assert.equal(originalAfter?.slug, originalBefore?.slug, 'original slug must not change')
    assert.equal(originalAfter?.creatives?.length, originalBefore?.creatives?.length, 'original creatives must not change')
    assert.ok(originalAfter?.locationTarget, 'original location target must remain')

    const dupStored = await prisma.advertisement.findUnique({ where: { id: dup.id }, include: { creatives: true, locationTarget: true } })
    assert.equal(dupStored?.creatives?.some((c) => c.format === 'SQUARE'), true, 'duplicate must preserve SQUARE creative')
    assert.equal(dupStored?.locationTarget?.radiusMiles, 25)
  } finally {
    if (dupId) await prisma.advertisement.deleteMany({ where: { id: dupId } })
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('duplicate untitled ad: title stays NULL and slug is unique', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined, dupId: string | undefined
  try {
    const user = await makeUser('dupNoTitle' + tag)
    userId = user.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id
    const ad = await AdvertisementService.create({
      title: undefined,
      placement: 'BROKER_LISTING_LOCAL',
      type: 'SPONSORED_BANNER',
      action: 'DISPLAY_ONLY',
      isEnabled: true,
      createdById: user.id,
      creativeAssignments: [{ mediaAssetId: media.id, format: 'SQUARE' }],
      locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
    })
    adId = ad.id
    const dup = await AdvertisementService.duplicate(ad.id, { title: undefined, createdById: user.id })
    dupId = dup.id
    assert.equal(dup.title, null, 'untitled duplicate must remain untitled')
    assert.notEqual(dup.slug, ad.slug)
    assert.equal((await prisma.advertisement.findUnique({ where: { id: dup.id } }))?.title, null)
  } finally {
    if (dupId) await prisma.advertisement.deleteMany({ where: { id: dupId } })
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('duplicate BROKER_LISTING_LOCAL: SQUARE + radius behavior preserved (Dallas shown, Houston hidden)', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined, dupId: string | undefined
  try {
    const user = await makeUser('duplocal' + tag)
    userId = user.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id
    const ad = await AdvertisementService.create({
      title: 'Local Original',
      placement: 'BROKER_LISTING_LOCAL',
      type: 'SPONSORED_BANNER',
      action: 'DISPLAY_ONLY',
      isEnabled: true,
      createdById: user.id,
      creativeAssignments: [{ mediaAssetId: media.id, format: 'SQUARE' }],
      locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
    })
    adId = ad.id
    const dup = await AdvertisementService.duplicate(ad.id, { title: undefined, createdById: user.id })
    dupId = dup.id
    // Duplicates start with a fresh (disabled) lifecycle; enable before rendering.
    await prisma.advertisement.update({ where: { id: dup.id }, data: { isEnabled: true } })

    const dallas = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.797 })
    assert.ok(dallas.some((a) => a.id === dup.id), 'duplicated local ad must render in Dallas')
    const houston = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 29.7604, longitude: -95.3698 })
    assert.equal(houston.some((a) => a.id === dup.id), false, 'duplicated local ad must stay hidden outside radius')
  } finally {
    if (dupId) await prisma.advertisement.deleteMany({ where: { id: dupId } })
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('duplicate BROKER_LISTING_LOCAL without SQUARE creative is rejected', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined
  try {
    const user = await makeUser('dupBad' + tag)
    userId = user.id
    const media = await prisma.mediaAsset.create({ data: { fileName: 'b-' + tag + '.webp', originalName: 'banner.webp', fileUrl: '/uploads/b-' + tag + '.webp', mimeType: 'image/webp', extension: 'webp', fileSize: 100, width: 1600, height: 300, uploaderId: user.id, isDeleted: false } })
    mediaId = media.id
    // Seed a legacy BROKER_LISTING_LOCAL ad with a HORIZONTAL creative (invalid per contract).
    const legacy = await prisma.advertisement.create({ data: { title: 'Legacy Local', slug: 'legacy-local-' + tag, placement: 'BROKER_LISTING_LOCAL', type: 'SECTION_BANNER', action: 'DISPLAY_ONLY', isEnabled: true, createdById: user.id } })
    adId = legacy.id
    await prisma.advertisementCreative.create({ data: { advertisementId: legacy.id, mediaAssetId: media.id, format: 'HORIZONTAL' } })

    await assert.rejects(
      () => AdvertisementService.duplicate(legacy.id, { title: 'Copy', createdById: user.id }),
      /require a SQUARE creative/,
      'duplicating a local ad without a SQUARE creative must be rejected',
    )
  } finally {
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('duplicate of a request-linked ad does not touch the original request relationship', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined, dupId: string | undefined, companyId: string | undefined, planId: string | undefined, reqId: string | undefined
  try {
    const user = await makeUser('dupReq' + tag)
    userId = user.id
    const { company, plan } = await makeCompany(tag)
    companyId = company.id
    planId = plan.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id

    const ad = await AdvertisementService.create({
      title: 'Request Ad',
      placement: 'BROKER_LISTING_LOCAL',
      type: 'SPONSORED_BANNER',
      action: 'DISPLAY_ONLY',
      isEnabled: true,
      companyId,
      createdById: user.id,
      creativeAssignments: [{ mediaAssetId: media.id, format: 'SQUARE' }],
      locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
    })
    adId = ad.id
    const req = await prisma.companyAdRequest.create({ data: { companyId, requestedById: user.id, status: 'REQUESTED', requestDetails: 'x' } })
    reqId = req.id
    await prisma.companyAdRequest.update({ where: { id: req.id }, data: { advertisementId: ad.id, status: 'FULFILLED' } })

    const dup = await AdvertisementService.duplicate(ad.id, { title: 'Request Ad Copy', createdById: user.id })
    dupId = dup.id

    const requestAfter = await prisma.companyAdRequest.findUnique({ where: { id: req.id } })
    assert.equal(requestAfter?.advertisementId, ad.id, 'original request must keep pointing at the original ad')
    assert.equal(requestAfter?.status, 'FULFILLED')
    const dupStored = await prisma.advertisement.findUnique({ where: { id: dup.id } })
    assert.equal(dupStored?.companyId, company.id, 'duplicate retains company association')
  } finally {
    if (reqId) await prisma.companyAdRequest.deleteMany({ where: { id: reqId } })
    if (dupId) await prisma.advertisement.deleteMany({ where: { id: dupId } })
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (companyId) { await prisma.companySubscription.deleteMany({ where: { companyId } }); await prisma.companyAdRequest.deleteMany({ where: { companyId } }); await prisma.company.deleteMany({ where: { id: companyId } }) }
    if (planId) await prisma.companyAdvertisingPlan.deleteMany({ where: { id: planId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})
