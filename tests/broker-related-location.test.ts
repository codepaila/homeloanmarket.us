import assert from 'node:assert/strict'
import fs from 'node:fs'
import test, { after, before } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { getRelatedBrokerIds } from '../lib/broker-listing'

// ===========================================================================
// PHASE — RELATED BROKER MATCHING (geographic relevance, then canonical rank)
//
// Related brokers must reuse the canonical geo (radius) + listing services and
// the canonical public eligibility rules — never a second visibility/ranking
// system. Geographic relevance is preferred over subscription ranking.
// ===========================================================================

const prisma = new PrismaClient()
const read = (p: string) => fs.readFileSync(p, 'utf8')
const listing = read('lib/broker-listing.ts')
const detail = read('app/(public)/brokers/[slug]/page.tsx')

const suffix = `rel-${Date.now()}`
const city = `RelatedCity${suffix}`
const cityOf = (label: string) => `${city}-${label}`
const createdIds: string[] = []
let dbReady = true

function brokerData(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    userId: null,
    creationSource: 'ADMIN_CREATED' as const,
    displayName: `Related ${slug}`,
    companyName: `Related Co ${slug}`,
    profileSlug: `${suffix}-${slug}`,
    description: 'Related broker test profile.',
    phone: '+15551230000',
    officeAddress: '1 Related St',
    city,
    state: 'WY',
    pinCode: '82001',
    verificationStatus: 'VERIFIED' as const,
    brokerStatus: 'FREE' as const,
    isVisible: true,
    ...overrides,
  }
}

async function create(slug: string, overrides: Record<string, unknown> = {}) {
  const broker = await prisma.broker.create({ data: brokerData(slug, overrides) })
  createdIds.push(broker.id)
  return broker
}

before(async () => {
  try {
    await prisma.$connect()
    await prisma.broker.findFirst({ select: { id: true } })
  } catch {
    dbReady = false
  }
})

after(async () => {
  if (createdIds.length) {
    await prisma.brokerSubscription.deleteMany({ where: { brokerId: { in: createdIds } } })
    await prisma.broker.deleteMany({ where: { id: { in: createdIds } } })
  }
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
// Source contract: geographic tiers reuse the canonical services
// ---------------------------------------------------------------------------

test('getRelatedBrokerIds reuses the canonical geo + listing services with public eligibility', () => {
  assert.match(listing, /export async function getRelatedBrokerIds/)
  assert.match(listing, /findBrokerIdsWithinRadius/)
  assert.match(listing, /radiusMiles: RELATED_BROKER_RADIUS_MILES/)
  assert.match(listing, /locationCity: input\.city/)
  assert.match(listing, /locationState: input\.state/)
  // Every tier queries with admin:false (canonical public eligibility).
  const fn = listing.slice(listing.indexOf('export async function getRelatedBrokerIds'))
  assert.ok((fn.match(/admin: false/g) || []).length >= 3, 'all tiers use canonical public eligibility')
  // The current broker is always excluded.
  assert.match(fn, /new Set<string>\(\[input\.brokerId\]\)/)
})

test('detail page uses the geographic related query, dedupes the broker read, and preserves id order', () => {
  assert.match(detail, /getRelatedBrokerIds/)
  assert.match(detail, /const getBrokerBySlug = cache\(/)
  assert.match(detail, /relatedIds[\s\S]*?\.map\(\(id\) => relatedById\.get\(id\)\)/)
  assert.doesNotMatch(detail, /getPublicListingPage\(\{\}, \{ page: 1, take: 4/)
})

// ---------------------------------------------------------------------------
// Geographic relevance beats subscription ranking
// ---------------------------------------------------------------------------

test('nearby same-city free broker is returned before a distant Featured broker', { skip: !dbReady }, async () => {
  const c = cityOf('a')
  const current = await create('current-a', { city: c })
  const nearby = await create('nearby-a', { city: c })
  const distant = await create('distant-a', { city: `OtherCityA${suffix}`, state: 'WY' })
  await prisma.brokerSubscription.create({
    data: { brokerId: distant.id, plan: 'FEATURED', isActive: true, endDate: null },
  })

  const ids = await getRelatedBrokerIds({ brokerId: current.id, city: c, state: 'WY', take: 1 })

  assert.equal(ids[0], nearby.id, 'geographically-local broker wins before the distant featured broker')
  assert.ok(!ids.includes(current.id), 'current broker is excluded')
  assert.ok(!ids.includes(distant.id), 'distant featured broker is not pulled in while a local one exists')
})

test('same-city broker is returned before same-state-only brokers', { skip: !dbReady }, async () => {
  const c = cityOf('b')
  const current = await create('current-b', { city: c })
  const sameCity = await create('samecity-b', { city: c })
  await create('samestate-b', { city: `OtherCityB${suffix}`, state: 'WY' })

  const ids = await getRelatedBrokerIds({ brokerId: current.id, city: c, state: 'WY', take: 2 })

  assert.equal(ids[0], sameCity.id, 'same-city broker ranks first')
  assert.ok(ids.length <= 2)
})

// ---------------------------------------------------------------------------
// Canonical public eligibility + exclusion
// ---------------------------------------------------------------------------

test('suspended and hidden brokers are excluded from related results', { skip: !dbReady }, async () => {
  const c = cityOf('c')
  const current = await create('current-c', { city: c })
  const suspended = await create('suspended-c', { city: c, brokerStatus: 'SUSPENDED' })
  const hidden = await create('hidden-c', { city: c, isVisible: false })

  const ids = await getRelatedBrokerIds({ brokerId: current.id, city: c, state: 'WY', take: 4 })

  assert.ok(!ids.includes(current.id))
  assert.ok(!ids.includes(suspended.id), 'suspended broker excluded')
  assert.ok(!ids.includes(hidden.id), 'hidden broker excluded')
})

test('missing city/state falls back without error and still excludes the current broker', { skip: !dbReady }, async () => {
  const current = await create('current-d', { city: `NoCity${suffix}`, state: null })
  const ids = await getRelatedBrokerIds({ brokerId: current.id, city: null, state: null, take: 3 })
  assert.ok(!ids.includes(current.id))
  assert.ok(ids.length <= 3)
})

test('unverified self-registered broker is excluded by the canonical eligibility rule', { skip: !dbReady }, async () => {
  const c = cityOf('e')
  const current = await create('current-e', { city: c })
  const selfUnverified = await create('selfunverified-e', {
    city: c,
    creationSource: 'SELF_REGISTERED',
    verificationStatus: 'UNVERIFIED',
  })

  const ids = await getRelatedBrokerIds({ brokerId: current.id, city: c, state: 'WY', take: 10 })

  assert.ok(!ids.includes(selfUnverified.id), 'unverified self-registered broker is not publicly eligible')
  assert.ok(!ids.includes(current.id))
})
