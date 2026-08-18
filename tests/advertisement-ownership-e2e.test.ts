import assert from 'node:assert/strict'
import test from 'node:test'
import prisma from '../lib/prisma'
import { AdvertisementService } from '../lib/advertisements/services'
import type { AdvertisementOwner } from '../lib/advertisements/types'

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

const localAd = (userId: string, mediaId: string, extra: Record<string, unknown> = {}) => ({
  title: 'Owner Audit Ad ' + suffix(),
  placement: 'BROKER_LISTING_LOCAL' as const,
  type: 'SPONSORED_BANNER',
  action: 'DISPLAY_ONLY',
  isEnabled: true,
  showDesktop: true,
  showTablet: true,
  showMobile: true,
  priority: 10,
  displayOrder: 0,
  createdById: userId,
  creativeAssignments: [{ mediaAssetId: mediaId, format: 'SQUARE' as const }],
  locationTarget: { locationLabel: 'Houston, TX', countryCode: 'US' as const, city: 'Houston', state: 'TX', latitude: 29.7604, longitude: -95.3698, radiusMiles: 25 },
  ...extra,
})

test('ownership: direct platform ad (company null, no request) creates and renders', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined
  try {
    const user = await makeUser('plat' + tag)
    userId = user.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id

    const ad = await AdvertisementService.create(localAd(user.id, media.id, { companyId: null }))
    adId = ad.id
    const stored = await prisma.advertisement.findUnique({ where: { id: ad.id }, select: { companyId: true } })
    assert.equal(stored?.companyId, null, 'platform ad must have companyId null')
    const request = await prisma.companyAdRequest.findFirst({ where: { advertisementId: ad.id } })
    assert.equal(request, null, 'platform ad must have no CompanyAdRequest')

    const houston = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 29.7604, longitude: -95.3698 })
    assert.ok(houston.some((a) => a.id === ad.id), 'company-less local ad appears in Houston')
  } finally {
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('ownership: direct company ad (companyId = Company A, no request)', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined, companyId: string | undefined, planId: string | undefined
  try {
    const user = await makeUser('co' + tag)
    userId = user.id
    const { company, plan } = await makeCompany(tag)
    companyId = company.id
    planId = plan.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id

    const ad = await AdvertisementService.create(localAd(user.id, media.id, { companyId: company.id }))
    adId = ad.id
    const stored = await prisma.advertisement.findUnique({ where: { id: ad.id }, select: { companyId: true } })
    assert.equal(stored?.companyId, company.id, 'company ad must be owned by the selected company')
    const request = await prisma.companyAdRequest.findFirst({ where: { advertisementId: ad.id } })
    assert.equal(request, null, 'direct company ad must have no CompanyAdRequest')
  } finally {
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (companyId) { await prisma.companySubscription.deleteMany({ where: { companyId } }); await prisma.companyAdRequest.deleteMany({ where: { companyId } }); await prisma.company.deleteMany({ where: { id: companyId } }) }
    if (planId) await prisma.companyAdvertisingPlan.deleteMany({ where: { id: planId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('ownership: request-created ad derives company, links, and fulfills', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined, companyId: string | undefined, planId: string | undefined, reqId: string | undefined
  try {
    const user = await makeUser('req' + tag)
    userId = user.id
    const { company, plan } = await makeCompany(tag)
    companyId = company.id
    planId = plan.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id

    const request = await prisma.companyAdRequest.create({ data: { companyId: company.id, requestedById: user.id, status: 'REQUESTED', requestDetails: 'request ad' } })
    reqId = request.id

    const { ad } = await AdvertisementService.createFromRequest({
      ...localAd(user.id, media.id),
      requestId: request.id,
      createdById: user.id,
    })
    adId = ad.id

    const stored = await prisma.advertisement.findUnique({ where: { id: ad.id }, select: { companyId: true } })
    assert.equal(stored?.companyId, company.id, 'ad companyId must equal the request companyId')

    const fulfilled = await prisma.companyAdRequest.findUnique({ where: { id: request.id } })
    assert.equal(fulfilled?.advertisementId, ad.id, 'request must point at the new advertisement')
    assert.equal(fulfilled?.status, 'FULFILLED', 'request must be FULFILLED only after creation')

    // Radius behavior: Houston in-radius shown, Dallas out-of-radius hidden.
    const houston = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 29.7604, longitude: -95.3698 })
    assert.ok(houston.some((a) => a.id === ad.id), 'request-created local ad shows in Houston')
    const dallas = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.797 })
    assert.equal(dallas.some((a) => a.id === ad.id), false, 'request-created local ad hidden outside radius')
  } finally {
    if (reqId) await prisma.companyAdRequest.deleteMany({ where: { id: reqId } })
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (companyId) { await prisma.companySubscription.deleteMany({ where: { companyId } }); await prisma.companyAdRequest.deleteMany({ where: { companyId } }); await prisma.company.deleteMany({ where: { id: companyId } }) }
    if (planId) await prisma.companyAdvertisingPlan.deleteMany({ where: { id: planId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('ownership: duplicate of a request-linked ad preserves company, drops request', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined, dupId: string | undefined, companyId: string | undefined, planId: string | undefined, reqId: string | undefined
  try {
    const user = await makeUser('dupOwn' + tag)
    userId = user.id
    const { company, plan } = await makeCompany(tag)
    companyId = company.id
    planId = plan.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id

    const ad = await AdvertisementService.create(localAd(user.id, media.id, { companyId: company.id }))
    adId = ad.id
    const request = await prisma.companyAdRequest.create({ data: { companyId: company.id, requestedById: user.id, status: 'REQUESTED', requestDetails: 'x' } })
    reqId = request.id
    await prisma.companyAdRequest.update({ where: { id: request.id }, data: { advertisementId: ad.id, status: 'FULFILLED' } })

    const dup = await AdvertisementService.duplicate(ad.id, { title: 'Dup', createdById: user.id })
    dupId = dup.id
    const dupStored = await prisma.advertisement.findUnique({ where: { id: dup.id }, select: { companyId: true } })
    assert.equal(dupStored?.companyId, company.id, 'duplicate preserves companyId')

    const dupRequest = await prisma.companyAdRequest.findFirst({ where: { advertisementId: dup.id } })
    assert.equal(dupRequest, null, 'duplicate must not inherit the request relationship')

    const originalRequest = await prisma.companyAdRequest.findUnique({ where: { id: request.id } })
    assert.equal(originalRequest?.advertisementId, ad.id, 'original request must keep pointing at the original ad')
    assert.equal(originalRequest?.status, 'FULFILLED')
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

test('ownership: request flow rejects a client-supplied company mismatch (server-derived)', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined, companyAId: string | undefined, companyBId: string | undefined, planAId: string | undefined, planBId: string | undefined, reqId: string | undefined
  try {
    const user = await makeUser('sec' + tag)
    userId = user.id
    const { company: companyA, plan: planA } = await makeCompany(tag + 'a')
    const { company: companyB, plan: planB } = await makeCompany(tag + 'b')
    companyAId = companyA.id
    companyBId = companyB.id
    planAId = planA.id
    planBId = planB.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id

    const request = await prisma.companyAdRequest.create({ data: { companyId: companyA.id, requestedById: user.id, status: 'REQUESTED' } })
    reqId = request.id

    // The createFromRequest signature omits companyId entirely — the company is
    // always derived from the request (Company A), never from the caller.
    const { ad } = await AdvertisementService.createFromRequest({
      ...localAd(user.id, media.id, { companyId: companyB.id }),
      requestId: request.id,
      createdById: user.id,
    })
    adId = ad.id
    const stored = await prisma.advertisement.findUnique({ where: { id: ad.id }, select: { companyId: true } })
    assert.equal(stored?.companyId, companyA.id, 'company must be derived from the request, ignoring any client value')
    assert.notEqual(stored?.companyId, companyB.id)
  } finally {
    if (reqId) await prisma.companyAdRequest.deleteMany({ where: { id: reqId } })
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    for (const [cid, pid] of [[companyAId, planAId], [companyBId, planBId]] as const) {
      if (cid) { await prisma.companySubscription.deleteMany({ where: { companyId: cid } }); await prisma.companyAdRequest.deleteMany({ where: { companyId: cid } }); await prisma.company.deleteMany({ where: { id: cid } }) }
      if (pid) await prisma.companyAdvertisingPlan.deleteMany({ where: { id: pid } })
    }
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('ownership: createFromRequest rejects an already-fulfilled request', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined, companyId: string | undefined, planId: string | undefined, reqId: string | undefined
  try {
    const user = await makeUser('dupReq' + tag)
    userId = user.id
    const { company, plan } = await makeCompany(tag)
    companyId = company.id
    planId = plan.id
    const media = await makeSquareMedia(user.id, tag)
    mediaId = media.id

    const request = await prisma.companyAdRequest.create({ data: { companyId: company.id, requestedById: user.id, status: 'REQUESTED' } })
    reqId = request.id
    const ad = await AdvertisementService.create(localAd(user.id, media.id, { companyId: company.id }))
    adId = ad.id
    await prisma.companyAdRequest.update({ where: { id: request.id }, data: { advertisementId: ad.id, status: 'FULFILLED' } })

    await assert.rejects(
      () => AdvertisementService.createFromRequest({ ...localAd(user.id, media.id), requestId: request.id, createdById: user.id }),
      /already fulfilled/,
    )
  } finally {
    if (reqId) await prisma.companyAdRequest.deleteMany({ where: { id: reqId } })
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (companyId) { await prisma.companySubscription.deleteMany({ where: { companyId } }); await prisma.companyAdRequest.deleteMany({ where: { companyId } }); await prisma.company.deleteMany({ where: { id: companyId } }) }
    if (planId) await prisma.companyAdvertisingPlan.deleteMany({ where: { id: planId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('owner type contract', () => {
  const platformOwner: AdvertisementOwner = { type: 'PLATFORM', companyId: null }
  const companyOwner: AdvertisementOwner = { type: 'COMPANY', companyId: 'company_123' }
  assert.equal(platformOwner.companyId, null)
  assert.equal(companyOwner.type, 'COMPANY')
  assert.equal(companyOwner.companyId, 'company_123')
})
