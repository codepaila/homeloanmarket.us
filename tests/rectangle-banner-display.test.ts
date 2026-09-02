import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import prisma from '../lib/prisma'
import { AdvertisementService } from '../lib/advertisements/services'
import { validateCreativeDimensions } from '../lib/advertisements/placementSpecs'
import { getCreativeRequirementForFormat } from '../lib/advertisements/requirements'
import { isFormatCompatible } from '../lib/advertisements/formats'

const suffix = () => Date.now() + '-' + Math.floor(Math.random() * 1e6)

async function makeUser(tag: string) {
  return prisma.user.create({ data: { name: 'Audit', email: tag + '@example.com', role: 'USER', isActive: true } })
}
async function makeBannerMedia(userId: string, tag: string) {
  return prisma.mediaAsset.create({ data: { fileName: 'bn-' + tag + '.webp', originalName: 'banner.webp', fileUrl: '/uploads/bn-' + tag + '.webp', mimeType: 'image/webp', extension: 'webp', fileSize: 100, width: 1600, height: 800, uploaderId: userId, isDeleted: false } })
}
async function makeCompany(tag: string) {
  const company = await prisma.company.create({ data: { name: 'Audit Co ' + tag, type: 'HOME_LOAN_COMPANY', address: '1 Main', contactName: 'A', contactPosition: 'Mgr', phone: '+1', bannerAddress: 'x', bannerPhone: '+1', status: 'ACTIVE', onboardedAt: new Date() } })
  const plan = await prisma.companyAdvertisingPlan.create({ data: { name: 'Audit Plan ' + tag, price: 10, billingInterval: 'month', isActive: true, stripeProductId: 'p-' + tag, stripePriceId: 'pr-' + tag } })
  await prisma.companySubscription.create({ data: { companyId: company.id, plan: 'ADVERTISING', planId: plan.id, status: 'ACTIVE', isActive: true } })
  return { company, plan }
}

const bannerAd = (userId: string, mediaId: string, extra: Record<string, unknown> = {}) => ({
  title: 'Banner Audit Ad ' + suffix(),
  placement: 'BROKER_LISTING_LOCAL' as const,
  type: 'SPONSORED_BANNER',
  action: 'BANNER_AND_BUTTON',
  isEnabled: true,
  showDesktop: true,
  showTablet: true,
  showMobile: true,
  priority: 10,
  displayOrder: 0,
  createdById: userId,
  creativeAssignments: [{ mediaAssetId: mediaId, format: 'BANNER' as const }],
  locationTarget: { locationLabel: 'Dallas, TX', countryCode: 'US' as const, city: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, radiusMiles: 25 },
  ...extra,
})

test('canonical BANNER format is 1600 x 800 at 2:1', () => {
  const req = getCreativeRequirementForFormat('BROKER_LISTING_LOCAL', 'BANNER')
  assert.equal(req.width, 1600)
  assert.equal(req.height, 800)
  assert.equal(req.aspectRatio, '2:1')
  assert.equal(req.label, 'Rectangle Display Banner')
})

test('1600x800 BANNER creative is accepted; incompatible dimensions rejected', () => {
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'BANNER', 1600, 800).ok, true)
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'BANNER', 1200, 800).ok, false)
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'BANNER', 1600, 1000).ok, false)
  assert.equal(validateCreativeDimensions('BROKER_LISTING_LOCAL', 'BANNER', 800, 800).ok, false)
})

test('frontend and backend share the same canonical dimension validation', () => {
  // MediaSelector (frontend) and AdvertisementService (backend) both call
  // validateCreativeDimensions from placementSpecs — a single source of truth.
  const mediaSelector = fs.readFileSync('components/admin/media/MediaSelector.tsx', 'utf8')
  const picker = fs.readFileSync('components/admin/ads/MediaPickerDialog.tsx', 'utf8')
  const service = fs.readFileSync('lib/advertisements/services.ts', 'utf8')
  assert.match(mediaSelector, /validateCreativeDimensions/)
  assert.match(picker, /validateCreativeDimensions/)
  assert.match(service, /validateCreativeDimensions/)
})

test('existing formats continue to work (RECTANGLE 1200x800 and SQUARE intact)', () => {
  assert.equal(validateCreativeDimensions('BLOG_INLINE', 'RECTANGLE', 1200, 800).ok, true)
  assert.equal(validateCreativeDimensions('HOMEPAGE_FEATURED', 'SQUARE', 800, 800).ok, true)
  assert.equal(validateCreativeDimensions('HOMEPAGE_HERO', 'HORIZONTAL', 1600, 300).ok, true)
})

test('BROKER_LISTING_LOCAL exposes SQUARE and BANNER only', () => {
  assert.equal(isFormatCompatible('BROKER_LISTING_LOCAL', 'SQUARE'), true)
  assert.equal(isFormatCompatible('BROKER_LISTING_LOCAL', 'BANNER'), true)
  assert.equal(isFormatCompatible('BROKER_LISTING_LOCAL', 'RECTANGLE'), false)
})

test('action metadata preserves the four display behaviors', () => {
  const requirements = fs.readFileSync('lib/advertisements/requirements.ts', 'utf8')
  assert.match(requirements, /DISPLAY_ONLY: \{ label: 'Display Only', needsButton: false, needsUrl: false/)
  assert.match(requirements, /BANNER_CLICK: \{ label: 'Banner Click', needsButton: false, needsUrl: true/)
  assert.match(requirements, /BUTTON_ONLY: \{ label: 'Button Only', needsButton: true, needsUrl: true/)
  assert.match(requirements, /BANNER_AND_BUTTON: \{ label: 'Banner \+ Button', needsButton: true, needsUrl: true/)
})

test('public renderer renders broker-listing local ads as a responsive grid respecting creative format', () => {
  const renderer = fs.readFileSync('components/advertisements/PublicAdvertisement.tsx', 'utf8')
  const card = fs.readFileSync('components/advertisements/AdvertisementCard.tsx', 'utf8')
  const image = fs.readFileSync('components/advertisements/AdvertisementImage.tsx', 'utf8')
  const aspect = fs.readFileSync('lib/advertisements/formatAspect.ts', 'utf8')
  // BROKER_LISTING_LOCAL renders EVERY matching ad (canonical SQUARE or BANNER)
  // as a compact responsive card grid — 3 columns desktop, 2 tablet, 1 mobile.
  // The card aspect ratio derives from the resolved creative format: SQUARE is
  // 1:1, BANNER is a 2:1 display banner. No full-width "giant" banner unit.
  assert.match(renderer, /placement === 'BROKER_LISTING_LOCAL'/)
  assert.match(renderer, /grid-cols-1.*sm:grid-cols-2.*lg:grid-cols-3/)
  assert.match(renderer, /formatAspectClass\(ad\.creativeFormat\)/)
  assert.match(renderer, /DisplayBannerCard/)
  assert.match(renderer, /isDisplayBanner = ad\.creativeFormat === 'BANNER' \|\| ad\.creativeFormat === 'WIDE_RECTANGLE'/)
  // The aspect helper maps SQUARE → 1:1 (aspect-square) and BANNER → 2:1.
  assert.match(aspect, /case '1:1':/)
  assert.match(aspect, /case '2:1':/)
  assert.match(aspect, /aspect-square/)
  assert.match(aspect, /aspect-\[2\/1\]/)
  // The shared card supports both contain and cover object-fit with no fixed
  // pixel widths, so it stays responsive and never overflows.
  assert.match(card, /objectFit=\{objectFit\}/)
  assert.doesNotMatch(card, /w-\[[0-9]+px\]/)
  assert.match(image, /object-cover/)
  assert.match(image, /object-contain/)
})

test('ownership: platform BANNER ad (company null, no request)', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined
  try {
    const user = await makeUser('bnplat' + tag)
    userId = user.id
    const media = await makeBannerMedia(user.id, tag)
    mediaId = media.id
    const ad = await AdvertisementService.create(bannerAd(user.id, media.id, { companyId: null }))
    adId = ad.id
    const stored = await prisma.advertisement.findUnique({ where: { id: ad.id }, select: { companyId: true } })
    assert.equal(stored?.companyId, null)
    const request = await prisma.companyAdRequest.findFirst({ where: { advertisementId: ad.id } })
    assert.equal(request, null)
    const dallas = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.797 })
    assert.ok(dallas.some((a) => a.id === ad.id), 'platform BANNER ad renders in radius')
  } finally {
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('ownership: company BANNER ad (companyId set, no request)', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined, companyId: string | undefined, planId: string | undefined
  try {
    const user = await makeUser('bnco' + tag)
    userId = user.id
    const { company, plan } = await makeCompany(tag)
    companyId = company.id
    planId = plan.id
    const media = await makeBannerMedia(user.id, tag)
    mediaId = media.id
    const ad = await AdvertisementService.create(bannerAd(user.id, media.id, { companyId: company.id }))
    adId = ad.id
    const stored = await prisma.advertisement.findUnique({ where: { id: ad.id }, select: { companyId: true } })
    assert.equal(stored?.companyId, company.id)
  } finally {
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (companyId) { await prisma.companySubscription.deleteMany({ where: { companyId } }); await prisma.companyAdRequest.deleteMany({ where: { companyId } }); await prisma.company.deleteMany({ where: { id: companyId } }) }
    if (planId) await prisma.companyAdvertisingPlan.deleteMany({ where: { id: planId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})

test('ownership: request-created BANNER ad derives company, links, and fulfills', async () => {
  const tag = suffix()
  let userId: string | undefined, mediaId: string | undefined, adId: string | undefined, companyId: string | undefined, planId: string | undefined, reqId: string | undefined
  try {
    const user = await makeUser('bnreq' + tag)
    userId = user.id
    const { company, plan } = await makeCompany(tag)
    companyId = company.id
    planId = plan.id
    const media = await makeBannerMedia(user.id, tag)
    mediaId = media.id
    const request = await prisma.companyAdRequest.create({ data: { companyId: company.id, requestedById: user.id, status: 'REQUESTED', requestDetails: 'banner request' } })
    reqId = request.id

    const { ad } = await AdvertisementService.createFromRequest({ ...bannerAd(user.id, media.id), requestId: request.id, createdById: user.id })
    adId = ad.id
    const stored = await prisma.advertisement.findUnique({ where: { id: ad.id }, select: { companyId: true } })
    assert.equal(stored?.companyId, company.id, 'company derived from request')
    const fulfilled = await prisma.companyAdRequest.findUnique({ where: { id: request.id } })
    assert.equal(fulfilled?.advertisementId, ad.id)
    assert.equal(fulfilled?.status, 'FULFILLED')
    const dallas = await AdvertisementService.findActiveAds('BROKER_LISTING_LOCAL', 'desktop', 10, new Date(), { latitude: 32.7767, longitude: -96.797 })
    assert.ok(dallas.some((a) => a.id === ad.id), 'request-created BANNER ad renders in radius')
  } finally {
    if (reqId) await prisma.companyAdRequest.deleteMany({ where: { id: reqId } })
    if (adId) await prisma.advertisement.deleteMany({ where: { id: adId } })
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } })
    if (companyId) { await prisma.companySubscription.deleteMany({ where: { companyId } }); await prisma.companyAdRequest.deleteMany({ where: { companyId } }); await prisma.company.deleteMany({ where: { id: companyId } }) }
    if (planId) await prisma.companyAdvertisingPlan.deleteMany({ where: { id: planId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
  }
})
