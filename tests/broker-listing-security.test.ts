import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test, { mock } from 'node:test'
import { NextRequest } from 'next/server'
import { toPublicBrokerRecord } from '../lib/public-broker'
import { isPublicBroker } from '../lib/broker-policy'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

// ===========================================================================
// PUBLIC CONTACT — email/phone are intentional public product data.
// ===========================================================================

test('all public broker surfaces pass includeContact: true', () => {
  for (const file of [
    'app/api/brokers/route.ts',
    'app/api/brokers/[id]/route.ts',
    'app/api/company/[slug]/route.ts',
    'app/(public)/brokers/[slug]/page.tsx',
  ]) {
    assert.match(read(file), /includeContact: true/, `${file} must expose public contact`)
  }
})

test('no public broker surface gates email/phone behind paid entitlement', () => {
  const listing = read('app/api/brokers/route.ts')
  assert.doesNotMatch(listing, /includeContact: canShowContact/)
  assert.doesNotMatch(listing, /canShowContact = hasPaidEntitlement/)

  const detail = read('app/api/brokers/[id]/route.ts')
  assert.doesNotMatch(detail, /includeContact: canShowContact/)
  assert.doesNotMatch(detail, /canShowContactFlag/)

  const profile = read('app/api/company/[slug]/route.ts')
  assert.doesNotMatch(profile, /includeContact: canShowContact/)
})

test('featured feed exposes email and phone (public contact)', () => {
  const featured = read('app/api/brokers/featured/route.ts')
  assert.match(featured, /email: true/)
  assert.match(featured, /phone: true/)
  assert.match(featured, /email: broker\.email/)
  assert.match(featured, /phone: broker\.phone/)
})

test('public DTO emits email and phone when includeContact is true', () => {
  const record = toPublicBrokerRecord({
    profileSlug: 'acme',
    displayName: 'Acme',
    email: 'broker@acme.com',
    phone: '+1-555-0100',
    whatsapp: '+1-555-0101',
    website: 'https://acme.com',
    officeAddress: '1 Main St',
    pinCode: '78701',
  }, { includeContact: true }) as Record<string, unknown>
  assert.equal(record.email, 'broker@acme.com')
  assert.equal(record.phone, '+1-555-0100')
  assert.equal(record.whatsapp, '+1-555-0101')
  assert.equal(record.website, 'https://acme.com')
  assert.equal(record.officeAddress, '1 Main St')
})

// ===========================================================================
// ELIGIBILITY — tier is ranking only; every eligible broker is listable.
// ===========================================================================

const complete = {
  isVisible: true,
  brokerStatus: 'FREE' as const,
  displayName: 'A',
  description: 'B',
  phone: '555',
  officeAddress: '1 Main',
  profileSlug: 'a',
}

test('eligibility: ADMIN_CREATED is eligible without explicit verification', () => {
  assert.equal(isPublicBroker({
    isVisible: true, verificationStatus: 'UNVERIFIED', brokerStatus: 'FREE',
    creationSource: 'ADMIN_CREATED', userId: null,
  }), true)
})

test('eligibility: SELF_REGISTERED VERIFIED is eligible; UNVERIFIED is not', () => {
  assert.equal(isPublicBroker({
    isVisible: true, verificationStatus: 'VERIFIED', brokerStatus: 'FREE',
    creationSource: 'SELF_REGISTERED', userId: null,
  }), true)
  assert.equal(isPublicBroker({
    isVisible: true, verificationStatus: 'UNVERIFIED', brokerStatus: 'FREE',
    creationSource: 'SELF_REGISTERED', userId: null,
  }), false)
})

test('eligibility: suspended / invisible / incomplete brokers are excluded', () => {
  assert.equal(isPublicBroker({ ...complete, verificationStatus: 'VERIFIED', brokerStatus: 'SUSPENDED', userId: null }), false)
  assert.equal(isPublicBroker({ ...complete, isVisible: false, verificationStatus: 'VERIFIED', userId: null }), false)
  assert.equal(isPublicBroker({ ...complete, profileComplete: false, verificationStatus: 'VERIFIED', userId: null }), false)
})

// ===========================================================================
// RANKING — tier ranks, never filters.
// ===========================================================================

test('listing aggregation does not $match on tier (Tier 4 brokers stay listable)', () => {
  const listing = read('lib/broker-listing.ts')
  const code = listing.replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(code, /\$match[^\n]*tier/, 'tier must not be a $match eligibility gate')
  assert.match(listing, /Tier is a RANKING signal, never a visibility gate/)
  assert.match(listing, /tier: 1, featuredRank: -1, experienceYears: -1, _id: 1/, 'deterministic tie-breakers')
})

test('featured eligibility requires active FEATURED with null/future endDate', () => {
  const featured = read('app/api/brokers/featured/route.ts')
  assert.match(featured, /plan: 'FEATURED'/)
  assert.match(featured, /endDate: null \}, \{ endDate: \{ gt: new Date\(\) \} \}/)
  assert.match(featured, /take: 8/)
})

// ===========================================================================
// QUERY HARDENING
// ===========================================================================

test('numeric listing filters reject NaN/Infinity at the boundary', () => {
  const listing = read('app/api/brokers/route.ts')
  assert.match(listing, /parseBoundedNumberFilter/)
  assert.match(listing, /!Number\.isFinite\(value\)/)
})

test('search input remains escaped and pagination/radius stay bounded', () => {
  const listingLib = read('lib/broker-listing.ts')
  assert.match(listingLib, /function escapeRegex/)
  assert.match(listingLib, /\\\$&/, 'escapeRegex replaces meta characters with an escaped literal')

  const listing = read('app/api/brokers/route.ts')
  assert.match(listing, /const take = TABLE_ROW_PAGE/)
  assert.match(listing, /page > totalPages/)
  assert.match(listing, /radius < 0 \|\| radius > 100/)
})

test('related brokers exclude the current broker, deduplicate, and are bounded', () => {
  const listingLib = read('lib/broker-listing.ts')
  assert.match(listingLib, /new Set<string>\(\[input\.brokerId\]\)/)
  assert.match(listingLib, /if \(seen\.has\(id\)\) continue/)
  assert.match(listingLib, /return collected\.slice\(0, take\)/)
})

// ===========================================================================
// RUNTIME — public contact present in listing + detail
// ===========================================================================

const state: {
  user: { id: string; role: string } | null
  broker: Record<string, unknown> | null
  listing: { ids: string[]; total: number }
} = { user: null, broker: null, listing: { ids: [], total: 0 } }

mock.module('@/lib/currentUser', {
  namedExports: { getCurrentUser: async () => state.user },
})

mock.module('@/lib/profile-view', {
  namedExports: { recordProfileView: async () => {} },
})

mock.module('@/lib/broker-listing', {
  namedExports: {
    getPublicListingPage: async () => state.listing,
  },
})

mock.module('@/lib/prisma', {
  defaultExport: {
    broker: {
      findMany: async () => (state.broker ? [state.broker] : []),
      findUnique: async () => state.broker,
      update: async () => ({}),
    },
  },
})

function baseBroker(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    profileSlug: 'acme',
    userId: 'owner-1',
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'ADMIN_CREATED',
    displayName: 'Acme Mortgage',
    description: 'A complete broker description for the public profile.',
    companyName: 'Acme Mortgage LLC',
    phone: '+1-555-0100',
    whatsapp: '+1-555-0101',
    email: 'broker@acme.com',
    website: 'https://acme.com',
    officeAddress: '100 Congress Ave',
    pinCode: '78701',
    city: 'Austin',
    state: 'TX',
    nmls: '123456',
    licenseStates: ['TX'],
    avgRating: 4.5,
    totalReviews: 3,
    totalLeads: 42,
    profileViews: 999,
    experienceYears: 5,
    mortgageExpertEnabled: false,
    socialLinks: null,
    subscription: { plan: 'FEATURED', isActive: true, endDate: null, planId: 'p1' },
    user: { name: 'Owner', image: null, isActive: true },
    _count: { reviews: 3 },
    ...overrides,
  }
}

test('GET /api/brokers (full mode) exposes public email/phone', async () => {
  state.user = null
  state.broker = baseBroker()
  state.listing = { ids: ['b1'], total: 1 }
  const { GET } = await import('../app/api/brokers/route')
  const res = await GET(new NextRequest('https://homeloanmarket.com/api/brokers?page=1'))
  assert.equal(res.status, 200)
  const body = await res.json()
  const broker = body.brokers[0]
  assert.equal(broker.email, 'broker@acme.com')
  assert.equal(broker.phone, '+1-555-0100')
  assert.equal(broker.canShowContact, true)
  assert.equal(broker.isFeatured, true)
  assert.equal(broker.displayName, 'Acme Mortgage')
})

test('GET /api/brokers (summary mode) stays a compact card projection', async () => {
  state.user = null
  state.broker = baseBroker()
  state.listing = { ids: ['b1'], total: 1 }
  const { GET } = await import('../app/api/brokers/route')
  const res = await GET(new NextRequest('https://homeloanmarket.com/api/brokers?page=1&mode=summary'))
  assert.equal(res.status, 200)
  const broker = (await res.json()).brokers[0]
  assert.equal(broker.email, undefined, 'summary is a card projection without contact fields')
  assert.equal(broker.profileSlug, 'acme')
  assert.equal(broker.displayName, 'Acme Mortgage')
})

test('GET /api/brokers/[id] exposes public email/phone for a free broker', async () => {
  state.user = null
  state.broker = baseBroker({ subscription: null })
  const { GET } = await import('../app/api/brokers/[id]/route')
  const res = await GET(
    new NextRequest('https://homeloanmarket.com/api/brokers/b1'),
    { params: Promise.resolve({ id: 'b1' }) },
  )
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.email, 'broker@acme.com')
  assert.equal(body.phone, '+1-555-0100')
  assert.equal(body.canShowContact, true)
  assert.equal(body.isFeatured, false)
})
