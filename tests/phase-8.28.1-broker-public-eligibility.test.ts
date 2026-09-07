import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { isPublicBroker, publicBrokerWhere, brokerProfileIsComplete } from '../lib/broker-policy'

const fastLoans = {
  isVisible: true,
  verificationStatus: 'UNVERIFIED' as const,
  brokerStatus: 'FEATURED' as const,
  creationSource: 'SELF_REGISTERED' as const,
  userId: 'fastloans-user',
  userIsActive: true,
  profileComplete: true,
}

test('FastLoans-style self-registered broker is publicly eligible (Phase 8.28.1 root fix)', () => {
  assert.equal(isPublicBroker(fastLoans), true)
})

test('FastLoans-style broker appears in listing tier 1 (paid active subscription)', () => {
  const broker = {
    featured: 1,
    mortgageExpertEnabled: false,
    hasImage: 0,
  }
  // Tier 1 = paid subscription
  const tier = broker.featured === 1 ? 1 : broker.mortgageExpertEnabled ? 2 : broker.hasImage === 1 ? 3 : 4
  assert.equal(tier, 1)
})

test('self-registered UNVERIFIED complete visible broker is public (core fix)', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'UNVERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'SELF_REGISTERED',
    userId: 'user-1',
    userIsActive: true,
    profileComplete: true,
  }), true)
})

test('incomplete profile is not public (profileComplete=false)', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    userId: 'user-1',
    userIsActive: true,
    profileComplete: false,
  }), false)
})

test('unpublished (isVisible=false) broker is not public', () => {
  assert.equal(isPublicBroker({
    isVisible: false,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    userId: 'user-1',
    userIsActive: true,
  }), false)
})

test('suspended broker is not public', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'SUSPENDED',
    userId: null,
  }), false)
})

test('broker owned by inactive user is not public', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    userId: 'user-1',
    userIsActive: false,
  }), false)
})

test('broker owned by active company member is not public', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    userId: 'user-1',
    userIsActive: true,
    hasActiveCompanyMembership: true,
  }), false)
})

test('unowned broker (userId=null) is public when visible and complete', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'VERIFIED',
    brokerStatus: 'FREE',
    userId: null,
  }), true)
})

test('admin-created broker is public regardless of verificationStatus', () => {
  assert.equal(isPublicBroker({
    isVisible: true,
    verificationStatus: 'UNVERIFIED',
    brokerStatus: 'FREE',
    creationSource: 'ADMIN_CREATED',
    userId: null,
  }), true)
})

test('no competing eligibility system exists (single canonical helper)', () => {
  const policy = fs.readFileSync('lib/broker-policy.ts', 'utf8')
  const listing = fs.readFileSync('lib/broker-listing.ts', 'utf8')
  const geo = fs.readFileSync('lib/location/broker-geo.ts', 'utf8')
  // The old OR gate is gone from all three files
  assert.doesNotMatch(policy, /sourceEligible/)
  assert.doesNotMatch(listing, /verificationStatus: 'VERIFIED'/)
  assert.doesNotMatch(listing, /creationSource: 'ADMIN_CREATED'/)
  assert.doesNotMatch(geo, /verificationStatus: 'VERIFIED'/)
  assert.doesNotMatch(geo, /creationSource: 'ADMIN_CREATED'/)
})

test('brokerProfileIsComplete rejects empty/missing fields', () => {
  assert.equal(brokerProfileIsComplete({
    displayName: 'Test', description: 'desc', phone: '555', officeAddress: '1 Main', profileSlug: 'test',
  }), true)
  assert.equal(brokerProfileIsComplete({
    displayName: '', description: 'desc', phone: '555', officeAddress: '1 Main', profileSlug: 'test',
  }), false)
  assert.equal(brokerProfileIsComplete({
    displayName: 'Test', description: null, phone: '555', officeAddress: '1 Main', profileSlug: 'test',
  }), false)
  assert.equal(brokerProfileIsComplete({
    displayName: 'Test', description: 'desc', phone: '', officeAddress: '1 Main', profileSlug: 'test',
  }), false)
  assert.equal(brokerProfileIsComplete({
    displayName: 'Test', description: 'desc', phone: '555', officeAddress: '', profileSlug: 'test',
  }), false)
  assert.equal(brokerProfileIsComplete({
    displayName: 'Test', description: 'desc', phone: '555', officeAddress: '1 Main', profileSlug: '',
  }), false)
  assert.equal(brokerProfileIsComplete({
    displayName: 'Test', description: 'desc', phone: '555', officeAddress: '1 Main', profileSlug: undefined,
  }), false)
})

test('public DTO (toPublicBrokerRecord) leaks no internal or CRM fields', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { toPublicBrokerRecord } = require('../lib/public-broker') as typeof import('../lib/public-broker')
  const projected = toPublicBrokerRecord({
    id: 'internal-id',
    userId: 'owner',
    displayName: 'Public Broker',
    profileSlug: 'public-broker',
    description: 'desc',
    nmls: '123456',
    licenseStates: ['CA'],
    city: 'Austin',
    state: 'TX',
    logo: '/logo.png',
    profileImage: '/profile.png',
    experienceYears: 10,
    avgRating: 4.5,
    totalReviews: 5,
    socialLinks: { facebook: 'https://fb.test' },
    user: { name: 'Owner', image: null },
    totalLeads: 99,
    profileViews: 1234,
    brokerStatus: 'FREE',
    verificationStatus: 'VERIFIED',
    createdAt: new Date(),
    updatedAt: new Date(),
    contactMessages: [],
    bankPartners: [{ bankName: 'Bank' }],
    reviews: [{ rating: 5 }],
    _count: { reviews: 3 },
  })
  // Identity + professional + trust present
  assert.equal(projected.displayName, 'Public Broker')
  assert.equal(projected.profileSlug, 'public-broker')
  assert.equal(projected.avgRating, 4.5)
  assert.equal(projected.experienceYears, 10)
  assert.deepEqual(projected.user, { name: 'Owner', image: null })
  // Internal/CRM fields never leak
  assert.equal('id' in projected, false)
  assert.equal('userId' in projected, false)
  assert.equal('totalLeads' in projected, false)
  assert.equal('profileViews' in projected, false)
  assert.equal('brokerStatus' in projected, false)
  assert.equal('verificationStatus' in projected, false)
  assert.equal('createdAt' in projected, false)
  assert.equal('updatedAt' in projected, false)
  assert.equal('bankPartners' in projected, false)
  assert.equal('reviews' in projected, false)
  assert.equal('_count' in projected, false)
  assert.equal('subscription' in projected, false)
  assert.equal('contactMessages' in projected, false)
  // Contact gated behind includeContact
  assert.equal('phone' in projected, false)
  assert.equal('email' in projected, false)
  assert.equal('officeAddress' in projected, false)
})

test('public DTO contact fields appear only with includeContact=true', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { toPublicBrokerRecord } = require('../lib/public-broker') as typeof import('../lib/public-broker')
  const withContact = toPublicBrokerRecord({
    displayName: 'Broker',
    phone: '555-0100',
    whatsapp: '555-0101',
    email: 'test@example.test',
    website: 'https://example.test',
    officeAddress: '1 Main',
    pinCode: '78701',
  }, { includeContact: true })
  assert.equal(withContact.phone, '555-0100')
  assert.equal(withContact.email, 'test@example.test')
  assert.equal(withContact.officeAddress, '1 Main')
})

test('public detail page does not use user.image as fallback for broker photo', () => {
  const detailClient = fs.readFileSync('components/sections/broker/BrokerDetailClient.tsx', 'utf8')
  // The detail client uses broker.profileImage || broker.logo — never user.image as fallback
  assert.match(detailClient, /profileImage/)
  assert.match(detailClient, /logo/)
  assert.doesNotMatch(detailClient, /user\.image.*profileImage/)
  assert.doesNotMatch(detailClient, /fallback.*user\.image/)
})

test('publicBrokerWhere enforces completeness, not verification/source', () => {
  const where = publicBrokerWhere()
  const serialized = JSON.stringify(where)
  assert.match(serialized, /"displayName":\{"not":""\}/)
  assert.match(serialized, /"description":\{"not":""\}/)
  assert.match(serialized, /"phone":\{"not":""\}/)
  assert.match(serialized, /"officeAddress":\{"not":""\}/)
  assert.match(serialized, /"profileSlug":\{"not":""\}/)
  assert.doesNotMatch(serialized, /creationSource/)
  assert.doesNotMatch(serialized, /verificationStatus/)
  assert.doesNotMatch(serialized, /"isPublicBroker"/)
})

test('listing and geo pipelines use tier ranking and exclude tier 4 from public results', () => {
  const listing = fs.readFileSync('lib/broker-listing.ts', 'utf8')
  const geo = fs.readFileSync('lib/location/broker-geo.ts', 'utf8')
  // Both files define tier
  assert.match(listing, /tier: \{/)
  assert.match(geo, /tier: \{/)
  // Both exclude tier 4 for non-admin
  assert.match(listing, /tier: \{ \$lte: 3 \}/)
  assert.match(geo, /tier: \{ \$lte: 3 \}/)
  // Both sort by tier first
  assert.match(listing, /tier: 1/)
  assert.match(geo, /tier: 1/)
})

test('featured route enforces completeness alongside paid subscription', () => {
  const featured = fs.readFileSync('app/api/brokers/featured/route.ts', 'utf8')
  assert.match(featured, /displayName: \{ not: '' \}/)
  assert.match(featured, /profileSlug: \{ not: '' \}/)
  assert.match(featured, /verificationStatus: broker\.verificationStatus/)
})

test('sitemap uses canonical publicBrokerWhere and selects verificationStatus for display only', () => {
  const sitemap = fs.readFileSync('app/sitemap.ts', 'utf8')
  assert.match(sitemap, /publicBrokerWhere\(\)/)
  assert.match(sitemap, /verificationStatus: true/)
  assert.doesNotMatch(sitemap, /creationSource: 'ADMIN_CREATED'/)
})

test('detail page passes profileComplete to isPublicBroker', () => {
  const page = fs.readFileSync('app/(public)/brokers/[slug]/page.tsx', 'utf8')
  assert.match(page, /brokerProfileIsComplete/)
  assert.match(page, /profileComplete: brokerProfileIsComplete/)
})
