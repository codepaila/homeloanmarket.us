import assert from 'node:assert/strict'
import test from 'node:test'
import prisma from '../lib/prisma'
import { AdvertisementService } from '../lib/advertisements/services'

// End-to-end verification of the company-request → advertisement → location
// target → broker-listing rendering flow using the canonical advertisement
// engine. Uses throwaway records cleaned up afterward.

async function setup() {
  const suffix = Date.now() + '-' + Math.floor(Math.random() * 1e6)
  const plan = await prisma.companyAdvertisingPlan.create({
    data: { name: 'Audit Plan ' + suffix, price: 100, billingInterval: 'month', isActive: true, stripeProductId: 'prod-' + suffix, stripePriceId: 'price-' + suffix },
  })
  const company = await prisma.company.create({
    data: { name: 'Audit Co ' + suffix, type: 'HOME_LOAN_COMPANY', address: '1 Main', contactName: 'A', contactPosition: 'Mgr', phone: '+1', bannerAddress: 'x', bannerPhone: '+1', status: 'ACTIVE', onboardedAt: new Date() },
  })
  await prisma.companySubscription.create({ data: { companyId: company.id, plan: 'ADVERTISING', planId: plan.id, status: 'ACTIVE', isActive: true } })
  const user = await prisma.user.create({ data: { name: 'Requester', email: 'req' + suffix + '@example.com', role: 'USER', isActive: true } })
  await prisma.companyMembership.create({ data: { companyId: company.id, userId: user.id, role: 'OWNER', isActive: true } })
  return { plan, company, user, suffix }
}

async function teardown(ids: { plan: string; company: string; user: string; ad?: string; media?: string }) {
  if (ids.ad) {
    await prisma.advertisementCreative.deleteMany({ where: { advertisementId: ids.ad } })
    await prisma.advertisement.deleteMany({ where: { id: ids.ad } })
  }
  if (ids.media) await prisma.mediaAsset.deleteMany({ where: { id: ids.media } })
  await prisma.companyAdRequest.deleteMany({ where: { companyId: ids.company } })
  await prisma.companyMembership.deleteMany({ where: { companyId: ids.company } })
  await prisma.user.deleteMany({ where: { id: ids.user } })
  await prisma.companySubscription.deleteMany({ where: { companyId: ids.company } })
  await prisma.company.deleteMany({ where: { id: ids.company } })
  await prisma.companyAdvertisingPlan.deleteMany({ where: { id: ids.plan } })
}

test('request → advertisement → location target → broker listing flow works end-to-end', async () => {
  const { plan, company, user } = await setup()
  const adId: string[] = []
  const mediaId: string[] = []
  try {
    // 1. Company submits a request with a Dallas location target.
    const req = await prisma.companyAdRequest.create({
      data: {
        companyId: company.id,
        requestedById: user.id,
        status: 'REQUESTED',
        requestDetails: 'Dallas advertising banner',
        targetLocation: { locationLabel: 'Dallas, TX', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.7970, radiusMiles: 25 },
      },
    })

    // 2. Admin approves.
    await prisma.companyAdRequest.update({ where: { id: req.id }, data: { status: 'APPROVED', reviewedById: user.id, reviewedAt: new Date() } })

    // 3. Create advertisement from request, with a location target + SQUARE creative.
    const ad = await prisma.advertisement.create({
      data: { title: 'Dallas Ad ' + Date.now(), slug: 'audit-dallas-' + Date.now(), placement: 'BROKER_LISTING_LOCAL', type: 'SECTION_BANNER', action: 'BANNER_AND_BUTTON', isEnabled: true, isArchived: false, isDeleted: false, companyId: company.id, createdById: user.id },
    })
    adId.push(ad.id)
    await prisma.advertisementLocationTarget.create({
      data: { advertisementId: ad.id, locationLabel: 'Dallas, TX', countryCode: 'US', city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.7970, radiusMiles: 25 },
    })
    const media = await prisma.mediaAsset.create({ data: { fileName: 'audit-' + Date.now() + '.webp', originalName: 'ad.webp', fileUrl: '/uploads/audit-' + Date.now() + '.webp', mimeType: 'image/webp', extension: 'webp', fileSize: 100, width: 800, height: 800, uploaderId: user.id, isDeleted: false } })
    mediaId.push(media.id)
    await prisma.advertisementCreative.create({ data: { advertisementId: ad.id, mediaAssetId: media.id, format: 'SQUARE' } })

    // 4. Link request → advertisement and mark FULFILLED.
    await prisma.companyAdRequest.update({ where: { id: req.id }, data: { advertisementId: ad.id, status: 'FULFILLED' } })

    // 5. Verify the relationship.
    const linked = await prisma.companyAdRequest.findUnique({ where: { id: req.id }, select: { advertisementId: true, status: true, companyId: true } })
    assert.equal(linked?.advertisementId, ad.id)
    assert.equal(linked?.status, 'FULFILLED')
    assert.equal(linked?.companyId, company.id)
    const adCheck = await prisma.advertisement.findUnique({ where: { id: ad.id }, select: { companyId: true, placement: true } })
    assert.equal(adCheck?.companyId, company.id)
    assert.equal(adCheck?.placement, 'BROKER_LISTING_LOCAL')
    const target = await prisma.advertisementLocationTarget.findUnique({ where: { advertisementId: ad.id }, select: { latitude: true, longitude: true, radiusMiles: true } })
    assert.equal(target?.latitude, 32.7767)
    assert.equal(target?.longitude, -96.7970)
    assert.equal(target?.radiusMiles, 25)

    // 6. Broker listing matching: within radius → shown; outside → hidden.
    const dallas = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.7970 })
    assert.ok(dallas.some((a) => a.id === ad.id), 'ad appears for Dallas (inside radius)')
    const houston = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 29.7604, longitude: -95.3698 })
    assert.equal(houston.some((a) => a.id === ad.id), false, 'ad is hidden for Houston (outside radius)')

    // 7. Disabled and expired ads are excluded.
    await prisma.advertisement.update({ where: { id: ad.id }, data: { isEnabled: false } })
    const disabled = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.7970 })
    assert.equal(disabled.some((a) => a.id === ad.id), false, 'disabled ad is excluded')
    await prisma.advertisement.update({ where: { id: ad.id }, data: { isEnabled: true, endDate: new Date(Date.now() - 1000) } })
    const expired = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.7970 })
    assert.equal(expired.some((a) => a.id === ad.id), false, 'expired ad is excluded')
  } finally {
    await teardown({ plan: plan.id, company: company.id, user: user.id, ad: adId[0], media: mediaId[0] })
  }
})
