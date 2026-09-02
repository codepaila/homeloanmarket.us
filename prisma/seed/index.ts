import {
  AdType,
  AdvertisementFormat,
  AdvertisementAction,
  AdvertisementPlacement,
  BrokerClaimEventType,
  BrokerClaimInvitationStatus,
  BrokerClaimStatus,
  BrokerCreationSource,
  BrokerStatus,
  ButtonVariant,
  Prisma,
  ReviewStatus,
  SubscriptionPlan,
  VerificationStatus,
} from '@prisma/client'
import { isPublicBroker } from '../../lib/broker-policy'
import { prisma, DEMO_SEED_DATE, ensureAdmin, hashPassword } from './helpers'
import { comparePassword } from '../../lib/aes'
import { hashClaimToken } from '../../lib/tokens'
import { DEMO_IMAGES } from './demo-images'
import { validateCreativeDimensions } from '../../lib/advertisements/placementSpecs'

const SEED_PASSWORD = 'LocalDev!2026'
const ACTIVE_FROM = new Date('2026-01-01T00:00:00.000Z')
const ACTIVE_UNTIL = new Date('2027-01-01T00:00:00.000Z')
const FUTURE_START = new Date('2026-08-20T00:00:00.000Z')

function validateSeedCreative(placement: string, format: AdvertisementFormat, width: number, height: number) {
  const result = validateCreativeDimensions(placement, format, width, height, format === 'MOBILE' ? 'mobile' : 'desktop')
  if (!result.ok) {
    throw new Error(`Seed creative invalid for ${placement} (${format}): ${result.reason}`)
  }
}

type SeedUser = { id: string; email: string; role: string; name: string }
type SeedBroker = { id: string; profileSlug: string; userId: string | null; city: string | null; state: string | null; isVisible: boolean; verificationStatus: VerificationStatus; brokerStatus: BrokerStatus; user?: { isActive: boolean } | null }

type BrokerSpec = {
  key: string
  first: string
  last: string
  company: string
  city: string
  state: string
  zip: string
  plan: 'FREE' | 'FEATURED'
  verified: boolean
  visible: boolean
  owned: boolean
  claimed: boolean
  years: number
  bio: string
  portraitIndex: number
  coverIndex: number
  views: number
}

const brokerSpecs: BrokerSpec[] = [
  { key: 'pacific-crest-home-lending', first: 'Sarah', last: 'Mitchell', company: 'Pacific Crest Home Lending', city: 'San Diego', state: 'CA', zip: '92101', plan: 'FEATURED', verified: true, visible: true, owned: true, claimed: false, years: 12, bio: 'Sarah Mitchell has spent more than a decade helping families in Southern California navigate purchase and refinance mortgages with clear, honest guidance.', portraitIndex: 2, coverIndex: 0, views: 1840 },
  { key: 'lone-star-mortgage-group', first: 'Michael', last: 'Rodriguez', company: 'Lone Star Mortgage Group', city: 'Austin', state: 'TX', zip: '78701', plan: 'FEATURED', verified: true, visible: true, owned: true, claimed: false, years: 9, bio: 'Michael Rodriguez works with first-time buyers and growing families across Central Texas, focusing on loan programs that fit real budgets.', portraitIndex: 3, coverIndex: 1, views: 1280 },
  { key: 'blue-ridge-home-finance', first: 'Emily', last: 'Carter', company: 'Blue Ridge Home Finance', city: 'Charlotte', state: 'NC', zip: '28202', plan: 'FREE', verified: false, visible: false, owned: true, claimed: false, years: 6, bio: 'Emily Carter supports buyers in the Carolinas through every step of the mortgage process, from pre-approval to closing.', portraitIndex: 0, coverIndex: 2, views: 320 },
  { key: 'evergreen-mortgage-advisors', first: 'David', last: 'Thompson', company: 'Evergreen Mortgage Advisors', city: 'Seattle', state: 'WA', zip: '98101', plan: 'FEATURED', verified: true, visible: true, owned: true, claimed: false, years: 15, bio: 'David Thompson has guided homeowners and investors in the Pacific Northwest for fifteen years, with a focus on refinancing and equity planning.', portraitIndex: 1, coverIndex: 2, views: 1560 },
  { key: 'sunrise-home-lending', first: 'Jessica', last: 'Williams', company: 'Sunrise Home Lending', city: 'Miami', state: 'FL', zip: '33101', plan: 'FREE', verified: true, visible: true, owned: true, claimed: false, years: 7, bio: 'Jessica Williams helps first-time buyers in South Florida understand their options and build a realistic path to homeownership.', portraitIndex: 4, coverIndex: 3, views: 640 },
  { key: 'liberty-home-finance', first: 'Ryan', last: 'Anderson', company: 'Liberty Home Finance', city: 'Denver', state: 'CO', zip: '80202', plan: 'FREE', verified: true, visible: true, owned: false, claimed: false, years: 8, bio: 'Ryan Anderson advises buyers across the Front Range on conventional, FHA, and VA loan options with a consultative approach.', portraitIndex: 5, coverIndex: 4, views: 890 },
] as const

const userSpecs: { key: string; first: string; last: string }[] = [
  { key: 'buyer-one', first: 'Hannah', last: 'Moore' },
  { key: 'buyer-two', first: 'Kevin', last: 'Patel' },
  { key: 'buyer-three', first: 'Olivia', last: 'Nguyen' },
  { key: 'buyer-four', first: 'Ethan', last: 'Brown' },
  { key: 'buyer-five', first: 'Mia', last: 'Garcia' },
  { key: 'buyer-six', first: 'Lucas', last: 'Kim' },
  { key: 'buyer-seven', first: 'Ava', last: 'Clark' },
  { key: 'buyer-eight', first: 'Noah', last: 'Lewis' },
  { key: 'buyer-nine', first: 'Isabella', last: 'Hall' },
  { key: 'buyer-ten', first: 'Mason', last: 'Young' },
]

const reviewTexts = [
  'Sarah explained the different loan options clearly and stayed responsive throughout the process.',
  'Working with Michael made our first home purchase feel manageable from pre-approval to closing.',
  'David helped us compare refinance offers and answered every question patiently.',
  'Jessica kept us informed at every step and found a program that fit our budget.',
  'Amanda was transparent about costs and never pressured us into a decision.',
  'Ryan explained the FHA requirements in plain language and guided us through the paperwork.',
  'The team communicated consistently and made the closing process smooth.',
  'Emily was thorough and helped us understand what we could realistically afford.',
  'Great guidance on conventional versus adjustable loans for our situation.',
  'Our refinance closed on time thanks to David’s attention to detail.',
  'Michael checked in regularly and made sure we understood each document.',
  'Professional, responsive, and genuinely helpful for first-time buyers.',
]

const contactTexts = [
  'I am a first-time buyer looking for guidance on down payment options in {city}.',
  'We are considering refinancing our current mortgage and would like to compare rates.',
  'Looking for a pre-approval before we start house hunting in {city}.',
  'Interested in learning whether we qualify for an FHA loan.',
  'We want to understand closing costs before making an offer on a home.',
]

function daysAgo(days: number, hour = 12) {
  const date = new Date(DEMO_SEED_DATE)
  date.setUTCDate(date.getUTCDate() - days)
  date.setUTCHours(hour, 0, 0, 0)
  return date
}

function isEligibleDemoBroker(broker: { isVisible: boolean; verificationStatus: VerificationStatus; brokerStatus: BrokerStatus; userId: string | null; user?: { isActive: boolean } | null }) {
  return isPublicBroker({
    isVisible: broker.isVisible,
    verificationStatus: broker.verificationStatus,
    brokerStatus: broker.brokerStatus,
    userId: broker.userId,
    userIsActive: broker.user?.isActive,
  })
}

async function seedUsers() {
  const users: Record<string, SeedUser> = {}
  let phoneIndex = 0
  const specs = [
    ...brokerSpecs.filter((spec) => spec.owned).map((spec) => [spec.key, `${spec.first} ${spec.last}`, 'BROKER'] as const),
    ...userSpecs.map((spec) => [spec.key, `${spec.first} ${spec.last}`, 'USER'] as const),
  ]
  for (const [key, name, role] of specs) {
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`
    const phone = `+15555${String(phoneIndex).padStart(5, '0')}`
    phoneIndex += 1
    const existing = await prisma.user.findUnique({ where: { email } })
    const passwordIsValid = existing?.password ? await comparePassword(SEED_PASSWORD, existing.password) : false
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { name, role, isActive: true, emailVerified: true, phone, ...(passwordIsValid ? {} : { password: await hashPassword(SEED_PASSWORD) }) } })
      : await prisma.user.create({ data: { name, email, phone, role, isActive: true, emailVerified: true, password: await hashPassword(SEED_PASSWORD), createdAt: daysAgo(30 + (phoneIndex % 40)) } })
    users[key] = { id: user.id, email, role, name }
  }
  return users
}

async function seedSubscription(brokerId: string, plan: 'FREE' | 'FEATURED', createdAt: Date) {
  await prisma.brokerSubscription.upsert({
    where: { brokerId },
      update: { plan: plan as SubscriptionPlan, isActive: true, startDate: createdAt, endDate: plan === 'FEATURED' ? ACTIVE_UNTIL : null },
    create: { brokerId, plan: plan as SubscriptionPlan, isActive: true, startDate: createdAt, endDate: plan === 'FEATURED' ? ACTIVE_UNTIL : null, createdAt },
  })
}

async function seedBrokers(users: Record<string, SeedUser>) {
  const brokers: SeedBroker[] = []

  for (let index = 0; index < brokerSpecs.length; index++) {
    const spec = brokerSpecs[index]
    const slug = spec.key
    const data = {
      userId: spec.owned ? users[spec.key].id : null,
      displayName: `${spec.first} ${spec.last}`,
      companyName: spec.company,
      creationSource: spec.owned ? (spec.claimed ? BrokerCreationSource.ADMIN_CREATED : BrokerCreationSource.SELF_REGISTERED) : BrokerCreationSource.ADMIN_CREATED,
      description: spec.bio,
      phone: `+1555100${String(index).padStart(3, '0')}`,
      email: `${spec.first.toLowerCase()}.${spec.last.toLowerCase()}@example.com`,
      website: 'https://homeloanmarket.com',
      officeAddress: `${400 + index} Market Street`,
      city: spec.city,
      state: spec.state,
      pinCode: spec.zip,
      logo: DEMO_IMAGES.brokers[spec.portraitIndex].url,
      coverImage: DEMO_IMAGES.brokerCovers[spec.coverIndex].url,
      experienceYears: spec.years,
      verificationStatus: spec.verified ? VerificationStatus.VERIFIED : VerificationStatus.UNVERIFIED,
      brokerStatus: spec.plan === 'FEATURED' ? BrokerStatus.FEATURED : BrokerStatus.FREE,
      isVisible: spec.visible,
      avgRating: 0,
      totalReviews: 0,
      totalLeads: 0,
      profileViews: spec.views,
    } satisfies Omit<Prisma.BrokerUncheckedCreateInput, 'profileSlug'>

    const broker = await prisma.broker.upsert({
      where: { profileSlug: slug },
      update: data,
      create: { ...data, profileSlug: slug, createdAt: daysAgo(40 + index * 3) },
    })
    if (spec.plan === 'FEATURED' || (spec.owned && spec.verified)) await seedSubscription(broker.id, spec.plan, broker.createdAt)
    brokers.push({ ...broker, user: spec.owned ? { isActive: true } : null })
  }
  return brokers
}

async function seedClaims(adminId: string, brokers: SeedBroker[], users: Record<string, SeedUser>) {
  const claimed = brokers.find((broker) => broker.profileSlug === 'pacific-crest-home-lending')
  const pending = brokers.find((broker) => broker.profileSlug === 'liberty-home-finance')
  if (!claimed || !claimed.userId || !pending || pending.userId) throw new Error('Seed claim fixtures require one owned and one unowned broker')

  const completedClaim = await prisma.brokerClaim.upsert({
    where: { brokerId: claimed.id },
    update: { status: BrokerClaimStatus.COMPLETED, startedAt: daysAgo(45), completedAt: daysAgo(40), completedByUserId: claimed.userId },
    create: { brokerId: claimed.id, status: BrokerClaimStatus.COMPLETED, startedAt: daysAgo(45), completedAt: daysAgo(40), completedByUserId: claimed.userId, createdAt: daysAgo(45) },
  })
  const completedHash = hashClaimToken('canonical-completed-claim')
  const completedInvitation = await prisma.brokerClaimInvitation.upsert({
    where: { tokenHash: completedHash },
    update: { brokerClaimId: completedClaim.id, recipientEmail: users['pacific-crest-home-lending'].email, status: BrokerClaimInvitationStatus.USED, expiresAt: daysAgo(-75), usedAt: daysAgo(40), revokedAt: null, createdById: adminId },
    create: { brokerClaimId: completedClaim.id, tokenHash: completedHash, recipientEmail: users['pacific-crest-home-lending'].email, status: BrokerClaimInvitationStatus.USED, expiresAt: daysAgo(-75), usedAt: daysAgo(40), createdById: adminId },
  })
  const completedEvent = await prisma.brokerClaimEvent.findFirst({ where: { brokerClaimId: completedClaim.id, invitationId: completedInvitation.id, eventType: BrokerClaimEventType.COMPLETED } })
  if (!completedEvent) await prisma.brokerClaimEvent.create({ data: { brokerClaimId: completedClaim.id, invitationId: completedInvitation.id, actorUserId: claimed.userId, eventType: BrokerClaimEventType.COMPLETED, metadata: { ownership: 'attached', source: 'canonical-seed' }, occurredAt: daysAgo(40) } })

  const invitedClaim = await prisma.brokerClaim.upsert({
    where: { brokerId: pending.id },
    update: { status: BrokerClaimStatus.INVITED, startedAt: null, completedAt: null, completedByUserId: null },
    create: { brokerId: pending.id, status: BrokerClaimStatus.INVITED, createdAt: daysAgo(6) },
  })
  const invitedHash = hashClaimToken('canonical-pending-claim')
  const invitedInvitation = await prisma.brokerClaimInvitation.upsert({
    where: { tokenHash: invitedHash },
    update: { brokerClaimId: invitedClaim.id, recipientEmail: users['buyer-one'].email, status: BrokerClaimInvitationStatus.ACTIVE, expiresAt: daysAgo(-21), usedAt: null, revokedAt: null, createdById: adminId },
    create: { brokerClaimId: invitedClaim.id, tokenHash: invitedHash, recipientEmail: users['buyer-one'].email, status: BrokerClaimInvitationStatus.ACTIVE, expiresAt: daysAgo(-21), createdById: adminId },
  })
  const invitedEvent = await prisma.brokerClaimEvent.findFirst({ where: { brokerClaimId: invitedClaim.id, invitationId: invitedInvitation.id, eventType: BrokerClaimEventType.GENERATED } })
  if (!invitedEvent) await prisma.brokerClaimEvent.create({ data: { brokerClaimId: invitedClaim.id, invitationId: invitedInvitation.id, actorUserId: adminId, eventType: BrokerClaimEventType.GENERATED, metadata: { source: 'canonical-seed' }, occurredAt: daysAgo(6) } })
}

async function seedReviewsAndContacts(brokers: SeedBroker[], users: Record<string, SeedUser>) {
  const publicBrokers = brokers.filter(isEligibleDemoBroker)

  let reviewIndex = 0
  for (const broker of publicBrokers) {
    const count = (reviewIndex % 2 === 0 ? 2 : 1) + (broker.brokerStatus === 'FEATURED' ? 1 : 0)
    for (let i = 0; i < count; i++) {
      const reviewer = users[userSpecs[(reviewIndex + i) % userSpecs.length].key]
      const reviewData = {
          brokerId: broker.id,
          userId: reviewer.id,
          rating: 4 + ((reviewIndex + i) % 2),
          comment: reviewTexts[(reviewIndex + i) % reviewTexts.length],
          status: 'APPROVED' as ReviewStatus,
          createdAt: daysAgo(30 + ((reviewIndex + i) % 25)),
        }
      const existingReview = await prisma.review.findFirst({ where: { brokerId: broker.id, userId: reviewer.id, comment: reviewData.comment } })
      if (existingReview) await prisma.review.update({ where: { id: existingReview.id }, data: reviewData })
      else await prisma.review.create({ data: reviewData })
      reviewIndex += 1
    }
  }

  let contactIndex = 0
  for (const broker of publicBrokers.slice(0, 6)) {
    const message = contactTexts[contactIndex % contactTexts.length].replace('{city}', broker.city || '')
    const reviewer = users[userSpecs[contactIndex % userSpecs.length].key]
    const contactData = {
        brokerId: broker.id,
        userId: reviewer.id,
        name: reviewer.name,
        phone: `+15553${String(contactIndex).padStart(4, '0')}`,
        email: `${reviewer.name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
        city: broker.city,
        subject: `Mortgage inquiry ${contactIndex + 1}`,
        message,
        contactType: 'email',
        propertyType: 'House',
        loanAmount: 350000 + contactIndex * 25000,
        loanType: 'Home Purchase',
        timeline: contactIndex % 2 === 0 ? '1-3_months' : 'exploring',
        priority: contactIndex === 0 ? 'high' : 'normal',
        agreeToMarketing: false,
        agreeToTerms: true,
        isRead: contactIndex % 2 === 0,
        isResponded: contactIndex % 2 === 0,
        createdAt: contactIndex < 2 ? daysAgo(contactIndex + 1) : daysAgo(15 + contactIndex),
      }
    const existingContact = await prisma.contactMessage.findFirst({ where: { brokerId: broker.id, subject: contactData.subject } })
    if (existingContact) await prisma.contactMessage.update({ where: { id: existingContact.id }, data: contactData })
    else await prisma.contactMessage.create({ data: contactData })
    contactIndex += 1
  }

  for (const broker of publicBrokers) {
    const reviews = await prisma.review.findMany({ where: { brokerId: broker.id, status: 'APPROVED' }, select: { rating: true } })
    await prisma.broker.update({
      where: { id: broker.id },
      data: {
        totalReviews: reviews.length,
        avgRating: reviews.length ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(2)) : 0,
        totalLeads: await prisma.contactMessage.count({ where: { brokerId: broker.id } }),
      },
    })
  }
}

async function seedMedia(uploaderId: string) {
  const folderNames = ['Broker Portraits', 'Advertisements', 'General']
  const folderIds: Record<string, string> = {}
  for (const name of folderNames) {
    const folder = await prisma.mediaFolder.upsert({ where: { path: `seed-owned/${name.toLowerCase().replace(/ /g, '-')}` }, update: { name, isDeleted: false }, create: { name, path: `seed-owned/${name.toLowerCase().replace(/ /g, '-')}`, isDeleted: false } })
    folderIds[name] = folder.id
  }

  const entries: { key: string; folder: string; fileUrl: string; title: string; width: number; height: number }[] = []
  const adImages = [...DEMO_IMAGES.advertisements.hero, ...DEMO_IMAGES.advertisements.sidebar, ...DEMO_IMAGES.advertisements.inline, ...DEMO_IMAGES.advertisements.footer, ...DEMO_IMAGES.advertisements.announcement, ...DEMO_IMAGES.advertisements.popup, ...DEMO_IMAGES.advertisements.mobile, ...DEMO_IMAGES.advertisements.square, ...DEMO_IMAGES.advertisements.button]
  for (let index = 0; index < adImages.length; index++) {
    entries.push({ key: adImages[index].key, folder: 'Advertisements', fileUrl: adImages[index].url, title: `Advertisement creative ${index + 1}`, width: adImages[index].width, height: adImages[index].height })
  }
  for (let index = 0; index < DEMO_IMAGES.brokers.length; index++) {
    entries.push({ key: DEMO_IMAGES.brokers[index].key, folder: 'Broker Portraits', fileUrl: DEMO_IMAGES.brokers[index].url, title: `Broker portrait ${index + 1}`, width: DEMO_IMAGES.brokers[index].width, height: DEMO_IMAGES.brokers[index].height })
  }
  entries.push({ key: DEMO_IMAGES.homepage[0].key, folder: 'General', fileUrl: DEMO_IMAGES.homepage[0].url, title: 'Site imagery', width: DEMO_IMAGES.homepage[0].width, height: DEMO_IMAGES.homepage[0].height })
  entries.push({ key: DEMO_IMAGES.blogs[1].key, folder: 'General', fileUrl: DEMO_IMAGES.blogs[1].url, title: 'Article imagery', width: DEMO_IMAGES.blogs[1].width, height: DEMO_IMAGES.blogs[1].height })
  entries.push({ key: DEMO_IMAGES.blogs[5].key, folder: 'General', fileUrl: DEMO_IMAGES.blogs[5].url, title: 'Article imagery', width: DEMO_IMAGES.blogs[5].width, height: DEMO_IMAGES.blogs[5].height })

  const assets: Record<string, { id: string; fileUrl: string }> = {}
  for (const entry of entries) {
    const fileName = `${entry.key}.jpg`
    const existing = await prisma.mediaAsset.findFirst({ where: { fileName, folderId: folderIds[entry.folder] } })
    const data = { title: entry.title, originalName: fileName, fileUrl: entry.fileUrl, thumbnailUrl: entry.fileUrl, mimeType: 'image/jpeg', extension: 'jpg', fileSize: 0, width: entry.width, height: entry.height, altText: entry.title, tags: ['seed-owned'], folderId: folderIds[entry.folder], uploaderId, isDeleted: false }
    const asset = existing ? await prisma.mediaAsset.update({ where: { id: existing.id }, data }) : await prisma.mediaAsset.create({ data: { ...data, fileName } })
    assets[entry.fileUrl] = { id: asset.id, fileUrl: entry.fileUrl }
  }
  return assets
}

const placementConfigs: Record<string, { type: AdType; action: AdvertisementAction; format: AdvertisementFormat; title: string; description: string; buttonUrl: string }> = {
  [AdvertisementPlacement.HOMEPAGE_HERO]: { type: AdType.HERO_BANNER, action: AdvertisementAction.BANNER_AND_BUTTON, format: AdvertisementFormat.HORIZONTAL, title: 'SmartMortgage: Find a Home Loan That Fits', description: 'Compare mortgage options with trusted professionals across the United States.', buttonUrl: '/brokers' },
  [AdvertisementPlacement.HOMEPAGE_SEARCH]: { type: AdType.INLINE_BANNER, action: AdvertisementAction.BANNER_CLICK, format: AdvertisementFormat.RECTANGLE, title: 'PrimeHome Finance: Start With the Right Questions', description: 'Understand your options before you begin your home search.', buttonUrl: '/guides' },
  [AdvertisementPlacement.BROKER_LISTING]: { type: AdType.SECTION_BANNER, action: AdvertisementAction.BANNER_CLICK, format: AdvertisementFormat.HORIZONTAL, title: 'RateFinder: Compare With Confidence', description: 'Connect with experienced mortgage brokers in your area.', buttonUrl: '/brokers' },
  [AdvertisementPlacement.BROKER_PROFILE_HEADER]: { type: AdType.HERO_BANNER, action: AdvertisementAction.BANNER_CLICK, format: AdvertisementFormat.HORIZONTAL, title: 'HomeBridge: Expert Guidance for Your Purchase', description: 'Get clear answers from a mortgage professional.', buttonUrl: '/blog' },
  [AdvertisementPlacement.FOOTER]: { type: AdType.FOOTER_BANNER, action: AdvertisementAction.BANNER_CLICK, format: AdvertisementFormat.HORIZONTAL, title: 'HomeLoanMarket: Plan Your Next Move', description: 'Explore practical guides, calculators, and trusted mortgage advice.', buttonUrl: '/guides' },
  [AdvertisementPlacement.ANNOUNCEMENT_TOP]: { type: AdType.ANNOUNCEMENT_BAR, action: AdvertisementAction.BANNER_CLICK, format: AdvertisementFormat.HORIZONTAL, title: 'New First-Time Buyer Guides Are Here', description: 'Learn what to expect before you make an offer.', buttonUrl: '/blog' },
  [AdvertisementPlacement.ANNOUNCEMENT_BOTTOM]: { type: AdType.ANNOUNCEMENT_BAR, action: AdvertisementAction.BANNER_CLICK, format: AdvertisementFormat.HORIZONTAL, title: 'Make Your Mortgage Plan Feel Simpler', description: 'Explore clear resources for your next home.', buttonUrl: '/blog' },
  [AdvertisementPlacement.LOAN_CALCULATOR]: { type: AdType.SECTION_BANNER, action: AdvertisementAction.BUTTON_ONLY, format: AdvertisementFormat.RECTANGLE, title: 'HomeRate: Know Your Monthly Payment', description: 'Estimate your budget before you start touring homes.', buttonUrl: '/calculator' },
  [AdvertisementPlacement.BROKER_LISTING_SIDEBAR]: { type: AdType.SIDEBAR_BANNER, action: AdvertisementAction.BANNER_AND_BUTTON, format: AdvertisementFormat.VERTICAL, title: 'MortgageWise: Start With a Clear Plan', description: 'Find local guidance for rates, refinancing, and home buying.', buttonUrl: '/brokers' },
  [AdvertisementPlacement.BLOG_INLINE]: { type: AdType.INLINE_BANNER, action: AdvertisementAction.BANNER_CLICK, format: AdvertisementFormat.RECTANGLE, title: 'NestLoan: Make Sense of Your Options', description: 'Read practical mortgage guidance from experienced advisors.', buttonUrl: '/blog' },
  [AdvertisementPlacement.MOBILE_HEADER_BANNER]: { type: AdType.HERO_BANNER, action: AdvertisementAction.BANNER_CLICK, format: AdvertisementFormat.MOBILE, title: 'HomeFund: Take the Next Step Toward Homeownership', description: 'Explore home financing guidance from your phone.', buttonUrl: '/brokers' },
}

async function upsertCreative(advertisementId: string, mediaAssetId: string, format: AdvertisementFormat) {
  return prisma.advertisementCreative.upsert({
    where: { advertisementId_format: { advertisementId, format } },
    update: { mediaAssetId },
    create: { advertisementId, mediaAssetId, format },
  })
}

async function seedAdvertisements(adminId: string, assets: Record<string, { id: string; fileUrl: string }>) {
  const ads: { id: string; slug: string; isEnabled: boolean; isArchived: boolean; isDeleted: boolean }[] = []
  let index = 0
  const creativePoolByFormat = {
    [AdvertisementFormat.HORIZONTAL]: DEMO_IMAGES.advertisements.hero,
    [AdvertisementFormat.RECTANGLE]: DEMO_IMAGES.advertisements.inline,
    [AdvertisementFormat.VERTICAL]: DEMO_IMAGES.advertisements.sidebar,
    [AdvertisementFormat.SQUARE]: DEMO_IMAGES.advertisements.square,
    [AdvertisementFormat.MOBILE]: DEMO_IMAGES.advertisements.mobile,
    [AdvertisementFormat.BANNER]: DEMO_IMAGES.advertisements.hero,
    [AdvertisementFormat.WIDE_RECTANGLE]: DEMO_IMAGES.advertisements.inline,
  }
  for (const [placement, config] of Object.entries(placementConfigs)) {
    const formatPool = creativePoolByFormat[config.format]
    const creativeImage = formatPool[index % formatPool.length]
    const creative = creativeImage.url
    const mobileImage = DEMO_IMAGES.advertisements.mobile[index % DEMO_IMAGES.advertisements.mobile.length]
    const mobileCreative = mobileImage.url
    const slug = `ad-${placement.toLowerCase()}`
    validateSeedCreative(placement, config.format, creativeImage.width, creativeImage.height)
    if (config.format !== AdvertisementFormat.MOBILE) validateSeedCreative(placement, AdvertisementFormat.MOBILE, mobileImage.width, mobileImage.height)
    const data = {
      title: config.title, description: config.description, placement: placement as AdvertisementPlacement, type: config.type, action: config.action,
      buttonVariant: ButtonVariant.PRIMARY, desktopMediaId: assets[creative].id, mobileMediaId: assets[mobileCreative].id, altText: config.title,
      bannerUrl: creative, buttonLabel: 'Learn More', buttonUrl: config.buttonUrl, openInNewTab: false, internalNotes: 'SEED_OWNED', isDismissible: placement === AdvertisementPlacement.ANNOUNCEMENT_TOP,
      displayOrder: 0, priority: 10 + index, startDate: ACTIVE_FROM, endDate: ACTIVE_UNTIL, isEnabled: true, isArchived: false, showDesktop: true, showTablet: true, showMobile: true, isDeleted: false, createdById: adminId, updatedById: adminId,
    }
    const ad = await prisma.advertisement.upsert({ where: { slug }, update: data, create: { ...data, slug, createdById: adminId } })
    await upsertCreative(ad.id, assets[creative].id, config.format)
    if (config.format !== AdvertisementFormat.MOBILE) await upsertCreative(ad.id, assets[mobileCreative].id, AdvertisementFormat.MOBILE)
    ads.push(ad)
    index += 1
  }

  const carouselAds = [
    { slug: 'ad-homepage-hero-refinance', placement: AdvertisementPlacement.HOMEPAGE_HERO, format: AdvertisementFormat.HORIZONTAL, creative: DEMO_IMAGES.advertisements.hero[1], title: 'Explore Refinance Options', description: 'Compare current mortgage options with a trusted advisor.', buttonUrl: '/brokers' },
    { slug: 'ad-homepage-hero-first-time', placement: AdvertisementPlacement.HOMEPAGE_HERO, format: AdvertisementFormat.HORIZONTAL, creative: DEMO_IMAGES.advertisements.hero[2], title: 'A Clearer Path to Your First Home', description: 'Connect with mortgage professionals who understand your goals.', buttonUrl: '/brokers' },
    { slug: 'ad-sidebar-home-equity', placement: AdvertisementPlacement.BROKER_LISTING_SIDEBAR, format: AdvertisementFormat.VERTICAL, creative: DEMO_IMAGES.advertisements.sidebar[1], title: 'Plan Your Next Move', description: 'Talk with a local advisor about home equity.', buttonUrl: '/brokers' },
    { slug: 'ad-blog-closing-costs', placement: AdvertisementPlacement.BLOG_INLINE, format: AdvertisementFormat.RECTANGLE, creative: DEMO_IMAGES.advertisements.inline[1], title: 'Understand Closing Costs', description: 'Know what to expect before you make an offer.', buttonUrl: '/blog' },
    { slug: 'ad-featured-square-planning', placement: AdvertisementPlacement.HOMEPAGE_FEATURED, format: AdvertisementFormat.SQUARE, creative: DEMO_IMAGES.advertisements.square[0], title: 'Start Planning with Confidence', description: 'Build a mortgage plan around your budget.', buttonUrl: '/calculator' },
    { slug: 'ad-featured-square-advisor', placement: AdvertisementPlacement.HOMEPAGE_FEATURED, format: AdvertisementFormat.SQUARE, creative: DEMO_IMAGES.advertisements.square[1], title: 'Find Your Local Expert', description: 'Compare experienced mortgage brokers.', buttonUrl: '/brokers' },
  ] as const
  for (let extraIndex = 0; extraIndex < carouselAds.length; extraIndex++) {
    const extra = carouselAds[extraIndex]
    const mobileCreative = DEMO_IMAGES.advertisements.mobile[extraIndex % DEMO_IMAGES.advertisements.mobile.length]
    validateSeedCreative(extra.placement, extra.format, extra.creative.width, extra.creative.height)
    validateSeedCreative(extra.placement, AdvertisementFormat.MOBILE, mobileCreative.width, mobileCreative.height)
    const data = {
      title: extra.title, description: extra.description, placement: extra.placement, type: AdType.SECTION_BANNER, action: AdvertisementAction.BANNER_AND_BUTTON,
      buttonVariant: ButtonVariant.PRIMARY, desktopMediaId: assets[extra.creative.url].id, mobileMediaId: assets[mobileCreative.url].id, altText: extra.title,
      bannerUrl: extra.creative.url, buttonLabel: 'Learn More', buttonUrl: extra.buttonUrl, openInNewTab: false, internalNotes: 'SEED_OWNED', isDismissible: false,
      displayOrder: extraIndex + 1, priority: 20 + extraIndex, startDate: ACTIVE_FROM, endDate: ACTIVE_UNTIL, isEnabled: true, isArchived: false, showDesktop: true, showTablet: true, showMobile: true, isDeleted: false, createdById: adminId, updatedById: adminId,
    }
    const ad = await prisma.advertisement.upsert({ where: { slug: extra.slug }, update: data, create: { ...data, slug: extra.slug, createdById: adminId } })
    await upsertCreative(ad.id, assets[extra.creative.url].id, extra.format)
    await upsertCreative(ad.id, assets[mobileCreative.url].id, AdvertisementFormat.MOBILE)
    ads.push(ad)
  }

  const scheduledCreative = DEMO_IMAGES.advertisements.hero[1].url
  const scheduledMobileCreative = DEMO_IMAGES.advertisements.mobile[0].url
  validateSeedCreative(AdvertisementPlacement.HOMEPAGE_CTA, AdvertisementFormat.HORIZONTAL, DEMO_IMAGES.advertisements.hero[1].width, DEMO_IMAGES.advertisements.hero[1].height)
  validateSeedCreative(AdvertisementPlacement.HOMEPAGE_CTA, AdvertisementFormat.MOBILE, DEMO_IMAGES.advertisements.mobile[0].width, DEMO_IMAGES.advertisements.mobile[0].height)
  const scheduledData = {
    title: 'Seasonal Home Buying Checklist', description: 'A handy checklist for spring buyers.', placement: AdvertisementPlacement.HOMEPAGE_CTA, type: AdType.SECTION_BANNER, action: AdvertisementAction.BANNER_CLICK,
    buttonVariant: ButtonVariant.PRIMARY, desktopMediaId: assets[scheduledCreative].id, mobileMediaId: assets[scheduledMobileCreative].id, altText: 'Home buying checklist',
    bannerUrl: scheduledCreative, buttonLabel: 'View', buttonUrl: '/blog', openInNewTab: false, internalNotes: 'SEED_OWNED', isDismissible: false,
    displayOrder: 0, priority: 30, startDate: FUTURE_START, endDate: ACTIVE_UNTIL, isEnabled: true, isArchived: false, showDesktop: true, showTablet: true, showMobile: true, isDeleted: false, createdById: adminId, updatedById: adminId,
  }
  const scheduled = await prisma.advertisement.upsert({ where: { slug: 'ad-scheduled-home-buying-checklist' }, update: scheduledData, create: { ...scheduledData, slug: 'ad-scheduled-home-buying-checklist', createdById: adminId } })
  await upsertCreative(scheduled.id, assets[scheduledCreative].id, AdvertisementFormat.HORIZONTAL)
  await upsertCreative(scheduled.id, assets[scheduledMobileCreative].id, AdvertisementFormat.MOBILE)
  ads.push(scheduled)
  return ads
}

async function seedBlogs() {
  const published = [
    ['how-mortgage-pre-approval-works', 'How Mortgage Pre-Approval Works', 'A clear guide to the mortgage pre-approval process and what it means for your home search.'],
    ['what-first-time-buyers-should-know', 'What First-Time Home Buyers Should Know', 'Practical guidance for your first home purchase, from budgeting to closing.'],
    ['understanding-closing-costs', 'Understanding Closing Costs', 'A breakdown of the fees you can expect when you close on a home.'],
    ['comparing-common-home-loan-options', 'Comparing Common Home Loan Options', 'Conventional, FHA, and VA loans compared for different buyer situations.'],
  ] as const
  const draft = ['planning-your-mortgage-budget', 'Planning Your Mortgage Budget'] as const
  const author = 'HomeLoanMarket Editorial Team'
  const posts = []
  for (let index = 0; index < published.length; index++) {
    const [slug, title, excerpt] = published[index]
    const data = { title, excerpt, content: `${excerpt}\n\nA detailed article for prospective home buyers.`, coverImage: DEMO_IMAGES.blogs[index % DEMO_IMAGES.blogs.length].url, author, tags: ['mortgage', 'home buying'], category: 'Home Buying', isPublished: true, publishedAt: daysAgo(10 + index * 8), seoTitle: title, seoDescription: excerpt.slice(0, 160) }
    posts.push(await prisma.blogPost.upsert({ where: { slug }, update: data, create: { ...data, slug } }))
  }
  const [draftSlug, draftTitle] = draft
  const draftData = { title: draftTitle, excerpt: 'A draft article about planning your mortgage budget.', content: 'Draft content.', coverImage: DEMO_IMAGES.blogs[7].url, author, tags: ['mortgage'], category: 'Home Buying', isPublished: false, publishedAt: null, seoTitle: null, seoDescription: null }
  posts.push(await prisma.blogPost.upsert({ where: { slug: draftSlug }, update: draftData, create: { ...draftData, slug: draftSlug } }))
  return posts
}

async function seedSettings() {
  const settings = {
    siteName: ['HomeLoanMarket', 'string', 'general'], siteDescription: ['Find trusted mortgage brokers across the United States.', 'string', 'general'], siteUrl: ['https://homeloanmarket.com', 'string', 'general'], defaultCurrency: ['USD', 'string', 'general'], timezone: ['America/New_York', 'string', 'system'], seoTitle: ['HomeLoanMarket | Find Trusted Mortgage Brokers in the US', 'string', 'seo'], seoDescription: ['Compare verified mortgage brokers across the United States.', 'string', 'seo'], enableRegistration: ['true', 'boolean', 'auth'], enableEmailVerification: ['true', 'boolean', 'auth'], maintenanceMode: ['false', 'boolean', 'system'], maxUploadSize: ['10485760', 'number', 'system'], contactEmail: ['support@homeloanmarket.com', 'string', 'contact'], contactPhone: ['+1-800-555-0199', 'string', 'contact'], contactAddress: ['United States', 'string', 'contact'], socialFacebook: ['https://facebook.com/homeloanmarket', 'string', 'social'], socialTwitter: ['https://twitter.com/homeloanmarket', 'string', 'social'], socialLinkedIn: ['https://linkedin.com/company/homeloanmarket', 'string', 'social'], socialInstagram: ['', 'string', 'social'], socialYouTube: ['', 'string', 'social'], footerDescription: ['HomeLoanMarket helps home buyers find and compare verified mortgage brokers across the United States.', 'string', 'general'], copyrightText: ['© HomeLoanMarket. All rights reserved.', 'string', 'general'],
  } as const
  for (const [key, [value, type, category]] of Object.entries(settings)) {
    const existing = await prisma.setting.findUnique({ where: { key } })
    if (!existing) await prisma.setting.create({ data: { key, value, type, category, description: `Seed setting: ${key}` } })
  }
}

const seedFaqsData: { question: string; answer: string; category: string; isActive: boolean }[] = [
  { question: 'What documents are required for a mortgage pre-approval?', answer: 'Lenders typically ask for government-issued identification, income verification such as recent pay stubs or tax returns, bank statements, and details about current debts. Your broker can provide a complete checklist for your situation.', category: 'Mortgage Basics', isActive: true },
  { question: 'What is the difference between a mortgage broker and a lender?', answer: 'A lender provides the loan directly, while a mortgage broker works with multiple lenders to help you compare options and find the best fit for your financial situation.', category: 'Mortgage Basics', isActive: true },
  { question: 'How much should I plan for a down payment?', answer: 'Many conventional loans accept down payments between 3% and 20% of the purchase price. FHA loans and certain first-time buyer programs allow lower down payments. Your broker can help you understand the options that apply to you.', category: 'Down Payments', isActive: true },
  { question: 'What is the difference between a fixed-rate and an adjustable-rate mortgage?', answer: 'A fixed-rate mortgage keeps the same interest rate for the life of the loan, while an adjustable-rate mortgage can change the rate after an initial period. The right choice depends on how long you plan to stay in the home.', category: 'Loan Options', isActive: true },
  { question: 'What are closing costs?', answer: 'Closing costs are the fees paid when a home purchase or refinance is finalized. They commonly include appraisal, title insurance, loan origination, and recording fees. Your Loan Estimate lists these costs before you close.', category: 'Buying', isActive: true },
  { question: 'How does a FHA loan differ from a conventional loan?', answer: 'FHA loans are insured by the Federal Housing Administration and often allow lower down payments and more flexible credit requirements. Conventional loans are not government-insured and may offer other advantages depending on your profile.', category: 'Loan Options', isActive: true },
  { question: 'Who qualifies for a VA home loan?', answer: 'VA home loans are available to eligible service members, veterans, and certain surviving spouses. They are guaranteed by the Department of Veterans Affairs and often do not require a down payment.', category: 'Loan Options', isActive: true },
  { question: 'What credit score do I need to qualify for a mortgage?', answer: 'Minimum credit score requirements vary by loan program and lender. Higher scores typically improve your rate options, and some programs are designed for borrowers rebuilding credit.', category: 'Credit', isActive: true },
  { question: 'When should I consider refinancing my mortgage?', answer: 'Refinancing can make sense when interest rates have improved, your credit has strengthened, or you want to change the length of your loan or access equity. Compare the costs against the long-term savings.', category: 'Refinancing', isActive: true },
  { question: 'Do first-time home buyers have special loan options?', answer: 'Yes. Many state and federal programs offer assistance for first-time buyers, including lower down payment requirements and favorable terms. Your broker can help you identify programs you may qualify for.', category: 'First-Time Buyers', isActive: true },
  { question: 'What are jumbo loans and when are they used?', answer: 'A jumbo loan exceeds the conforming loan limits set for conventional mortgages. They are used for higher-priced homes and typically have stricter credit and down payment requirements.', category: 'Loan Options', isActive: false },
]

async function seedFaqs() {
  for (let index = 0; index < seedFaqsData.length; index++) {
    const faq = seedFaqsData[index]
    const data = {
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        displayOrder: index,
        isActive: faq.isActive,
        createdAt: daysAgo(30 + index),
      }
    const existing = await prisma.fAQ.findFirst({ where: { question: faq.question } })
    if (existing) await prisma.fAQ.update({ where: { id: existing.id }, data })
    else await prisma.fAQ.create({ data })
  }
}

export async function seedCanonicalData() {
  const admin = await ensureAdmin()
  const users = await seedUsers()
  const brokers = await seedBrokers(users)
  await seedClaims(admin.id, brokers, users)
  const assets = await seedMedia(admin.id)
  const ads = await seedAdvertisements(admin.id, assets)
  await seedReviewsAndContacts(brokers, users)
  await seedBlogs()
  await seedFaqs()
  await seedSettings()
  console.log(`Users: created/updated ${Object.keys(users).length + 1}. Companies: represented by broker companyName values. Brokers: created/updated ${brokers.length}. Claims: completed 1 / invited 1. Advertisements: created/updated ${ads.length} by admin. Media: created/updated ${Object.keys(assets).length} by admin. Settings: reconciled known keys.`)
}

async function resetTargetDatabase() {
  const deletions = [
    ['AdEvent', () => prisma.adEvent.deleteMany()],
    ['AdvertisementCreative', () => prisma.advertisementCreative.deleteMany()],
    ['Advertisement', () => prisma.advertisement.deleteMany()],
    ['MediaAsset', () => prisma.mediaAsset.deleteMany()],
    ['MediaFolder', () => prisma.mediaFolder.deleteMany()],
    ['SupportMessage', () => prisma.supportMessage.deleteMany()],
    ['SupportTicket', () => prisma.supportTicket.deleteMany()],
    ['Message', () => prisma.message.deleteMany()],
    ['Notification', () => prisma.notification.deleteMany()],
    ['Review', () => prisma.review.deleteMany()],
    ['ContactMessage', () => prisma.contactMessage.deleteMany()],
    ['BrokerBank', () => prisma.brokerBank.deleteMany()],
    ['BrokerClaimEvent', () => prisma.brokerClaimEvent.deleteMany()],
    ['BrokerClaimInvitation', () => prisma.brokerClaimInvitation.deleteMany()],
    ['BrokerClaim', () => prisma.brokerClaim.deleteMany()],
    ['BrokerSubscription', () => prisma.brokerSubscription.deleteMany()],
    ['Account', () => prisma.account.deleteMany()],
    ['Broker', () => prisma.broker.deleteMany()],
    ['LoanProduct', () => prisma.loanProduct.deleteMany()],
    ['Bank', () => prisma.bank.deleteMany()],
    ['Property', () => prisma.property.deleteMany()],
    ['BlogPost', () => prisma.blogPost.deleteMany()],
    ['FAQ', () => prisma.fAQ.deleteMany()],
    ['Testimonial', () => prisma.testimonial.deleteMany()],
    ['Setting', () => prisma.setting.deleteMany()],
    ['StripeWebhookEvent', () => prisma.stripeWebhookEvent.deleteMany()],
    ['User', () => prisma.user.deleteMany()],
  ] as const
  let removed = 0
  for (const [, deleteRecords] of deletions) removed += (await deleteRecords()).count
  return { collections: deletions.length, removed }
}

function validateDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL
  if (!rawUrl) throw new Error('DATABASE_URL is required')
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('DATABASE_URL must be a valid MongoDB connection string')
  }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use mongodb:// or mongodb+srv://')
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || '(default)'
  return `${parsed.protocol}//${parsed.hostname}/${database}`
}

async function main() {
  const target = validateDatabaseUrl()
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_DESTRUCTIVE !== 'true') {
    throw new Error('Destructive seed requires SEED_ALLOW_DESTRUCTIVE=true when NODE_ENV=production')
  }
  console.log(`Seed target: ${target}`)
  const reset = await resetTargetDatabase()
  console.log(`Database reset: ${reset.collections} collections cleared, ${reset.removed} records removed.`)
  await seedCanonicalData()
}

main()
  .catch((error) => {
    console.error('Seed failed:', error instanceof Error ? error.message : 'Unknown error')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
