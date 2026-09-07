import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { getPublicListingPage } from '../lib/broker-listing'
import { publicBrokerWhere } from '../lib/broker-policy'
import prisma from '../lib/prisma'

const read = (file: string) => fs.readFileSync(file, 'utf8')

// Phase 8.28.2 root cause: `tier` referenced `$featured`/`$hasImage` inside the
// SAME $addFields stage. MongoDB resolves a field reference within the same
// stage against the INPUT document, so those computed fields always read as
// missing and every broker without `mortgageExpertEnabled` (the only real
// stored field checked) fell to tier 4 and was dropped from the public listing.
// Only the 5 admin-enabled Mortgage Expert brokers survived.
test('listing and radius pipelines materialize featured/hasImage in a stage BEFORE tier', () => {
  for (const file of ['lib/broker-listing.ts', 'lib/location/broker-geo.ts']) {
    const segments = read(file).split('$addFields').slice(1)
    const featuredIdx = segments.findIndex((s) => /^\s*featured\s*:/m.test(s))
    const hasImageIdx = segments.findIndex((s) => /^\s*hasImage\s*:/m.test(s))
    const tierIdx = segments.findIndex((s) => /^\s*tier\s*:/m.test(s))
    assert.ok(featuredIdx >= 0, `${file} must compute featured in its own stage`)
    assert.ok(hasImageIdx >= 0, `${file} must compute hasImage in its own stage`)
    assert.ok(tierIdx > featuredIdx && tierIdx > hasImageIdx,
      `${file}: tier must be computed in a LATER stage than featured/hasImage (same-stage references resolve against the input document)`)
  }
})

test('hasImage checks require a real non-empty string field (missing/null never count)', () => {
  for (const file of ['lib/broker-listing.ts', 'lib/location/broker-geo.ts']) {
    const src = read(file)
    assert.match(src, /\$type: '\$profileImage'/, `${file} guards profileImage with a string type check`)
    assert.match(src, /\$type: '\$logo'/, `${file} guards logo with a string type check`)
  }
})

// Live-DB verification: the canonical listing must not silently drop eligible
// brokers. Environment-safe — when the DB (or the geo index) is absent these
// tests no-op rather than fail.
function hasActiveFeaturedSubscription(broker: {
  subscription?: { plan?: string | null; isActive?: boolean; endDate?: Date | null } | null
}) {
  const s = broker.subscription
  return Boolean(s?.plan === 'FEATURED' && s.isActive === true && (!s.endDate || s.endDate > new Date()))
}

function hasImage(broker: { profileImage?: string | null; logo?: string | null }) {
  return Boolean(
    (typeof broker.profileImage === 'string' && broker.profileImage !== '') ||
    (typeof broker.logo === 'string' && broker.logo !== ''),
  )
}

test('live public listing includes every active FEATURED-subscription broker (tier 1)', async () => {
  try {
    const paid = await prisma.broker.findMany({
      where: {
        ...publicBrokerWhere(),
        subscription: {
          is: { isActive: true, plan: 'FEATURED', OR: [{ endDate: null }, { endDate: { gt: new Date() } }] },
        },
      },
      select: { profileSlug: true },
    })
    if (paid.length === 0) return

    const page = await getPublicListingPage({}, { page: 1, take: 1000, admin: false })
    const listed = await prisma.broker.findMany({
      where: { id: { in: page.ids } },
      select: { profileSlug: true },
    })
    const listedSlugs = new Set(listed.map((b) => b.profileSlug))
    for (const broker of paid) {
      assert.ok(listedSlugs.has(broker.profileSlug), `paid FEATURED broker ${broker.profileSlug} must appear in the public listing`)
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'P1001' || (error as Error).message?.includes('ECONNREFUSED')) return
    throw error
  }
})

test('live public listing total equals the eligible broker count across ALL four tiers (no unexplained disappearance)', async () => {
  try {
    const brokers = await prisma.broker.findMany({
      where: publicBrokerWhere(),
      select: {
        profileSlug: true,
        mortgageExpertEnabled: true,
        profileImage: true,
        logo: true,
        subscription: { select: { plan: true, isActive: true, endDate: true } },
      },
    })

    let tier1 = 0
    let tier2 = 0
    let tier3 = 0
    let tier4 = 0
    for (const broker of brokers) {
      if (hasActiveFeaturedSubscription(broker)) tier1 += 1
      else if (broker.mortgageExpertEnabled) tier2 += 1
      else if (hasImage(broker)) tier3 += 1
      else tier4 += 1
    }
    // Phase 8.30: EVERY eligible broker is public, including tier 4 (no-image,
    // no Mortgage Expert, no paid subscription). Image affects ranking only.
    const expectedTotal = tier1 + tier2 + tier3 + tier4

    const page = await getPublicListingPage({}, { page: 1, take: 1000, admin: false })
    assert.equal(page.total, expectedTotal,
      `listing total (${page.total}) must equal the eligible broker count (${expectedTotal} = ${tier1}+${tier2}+${tier3}+${tier4}); no tier may be excluded`)
  } catch (error) {
    if ((error as { code?: string }).code === 'P1001' || (error as Error).message?.includes('ECONNREFUSED')) return
    throw error
  }
})

test('live public listing returns ALL eligible self-registered and admin-created brokers (image or not)', async () => {
  try {
    const page = await getPublicListingPage({}, { page: 1, take: 1000, admin: false })
    const listed = await prisma.broker.findMany({
      where: { id: { in: page.ids } },
      select: { profileSlug: true, creationSource: true },
    })
    const listedSlugs = new Set(listed.map((b) => b.profileSlug))

    const candidates = await prisma.broker.findMany({
      where: {
        ...publicBrokerWhere(),
        creationSource: { in: ['SELF_REGISTERED', 'ADMIN_CREATED'] },
      },
      select: { profileSlug: true, creationSource: true },
    })
    if (candidates.length === 0) return

    for (const broker of candidates) {
      assert.ok(listedSlugs.has(broker.profileSlug),
        `eligible ${broker.creationSource} broker ${broker.profileSlug} must be publicly listed even without image/ME/paid signals`)
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'P1001' || (error as Error).message?.includes('ECONNREFUSED')) return
    throw error
  }
})