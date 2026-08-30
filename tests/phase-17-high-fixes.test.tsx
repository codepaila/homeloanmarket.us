import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { toPublicBrokerRecord } from '../lib/public-broker'
import { pickBrokerEditableFields, BROKER_EDITABLE_FIELDS, BROKER_ADMIN_FIELDS } from '../lib/broker-policy'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

const PROTECTED_CONTACT_FIELDS = ['phone', 'whatsapp', 'email', 'website', 'officeAddress', 'pinCode']

function fullBrokerRecord() {
  return {
    id: 'b1',
    profileSlug: 'acme-mortgage',
    userId: 'u-owner',
    displayName: 'Acme Mortgage',
    companyName: 'Acme Mortgage LLC',
    city: 'Austin',
    state: 'TX',
    phone: '+1-555-0100',
    whatsapp: '+1-555-0100',
    email: 'broker@acme.com',
    website: 'https://acme.com',
    officeAddress: '100 Congress Ave',
    pinCode: '78701',
    avgRating: 4.8,
    totalLeads: 42,
    profileViews: 999,
    user: { id: 'u-owner', name: 'Owner', email: 'owner@acme.com', phone: '+1', image: null },
  }
}

// =============================================================
// H1 — Contact paywall enforced server-side
// =============================================================

test('H1: public broker DTO hides protected contact fields by default', () => {
  const record = toPublicBrokerRecord(fullBrokerRecord()) as Record<string, unknown>
  for (const field of PROTECTED_CONTACT_FIELDS) {
    assert.equal(record[field], undefined, `protected field ${field} must be omitted`)
  }
  assert.equal(record.profileSlug, 'acme-mortgage', 'public identity must remain available')
  assert.equal(record.city, 'Austin', 'non-sensitive location must remain available')
  assert.equal(record.displayName, 'Acme Mortgage', 'name must remain available')
  assert.equal(record.userId, undefined, 'owner user id must never be exposed')
  assert.equal(record.user && (record.user as { email?: string }).email, undefined, 'account email must never be exposed')
})

test('H1: public broker DTO includes contact only when entitled', () => {
  const record = toPublicBrokerRecord(fullBrokerRecord(), { includeContact: true }) as Record<string, unknown>
  for (const field of PROTECTED_CONTACT_FIELDS) {
    assert.notEqual(record[field], undefined, `entitled caller must receive ${field}`)
  }
})

test('H1: listing route gates contact fields by paid entitlement', () => {
  const source = read('app/api/brokers/route.ts')
  assert.ok(source.includes('canShowContact = hasPaidEntitlement(broker.subscription)'), 'listing must compute paid entitlement')
  assert.ok(source.includes('includeContact: canShowContact'), 'listing must pass the flag to the DTO')
})

test('H1: admin detail route gates contact fields by paid/owner/admin', () => {
  const source = read('app/api/brokers/[id]/route.ts')
  assert.ok(source.includes('includeContact: canShowContactFlag'), 'admin detail route must pass the entitlement flag')
  assert.ok(source.includes("currentUser?.role === 'ADMIN'"), 'admin detail route must treat admins as entitled')
  assert.ok(source.includes('canShowContact || isOwner'), 'admin detail route must treat owners as entitled')
})

test('H1: public profile route exposes contact for every eligible broker', () => {
  const source = read('app/api/company/[slug]/route.ts')
  assert.ok(source.includes('includeContact: true'), 'public profile must always include contact fields')
  assert.ok(source.includes('canShowContact: true'), 'public profile must always expose canShowContact')
  assert.equal(source.includes('canShowContact = hasPaidEntitlement'), false, 'public profile must not gate contact by subscription')
})

test('H1: featured feed applies the public DTO instead of leaking raw records', () => {
  const source = read('app/api/brokers/featured/route.ts')
  // Each featured broker is explicitly projected to a public display record
  // (id, identity, location, ratings, badges) rather than returned raw.
  assert.match(source, /brokers: brokers\.map\(\(broker\) => \(\{/)
  assert.ok(!/return NextResponse\.json\(\{ brokers \}\)/.test(source), 'raw broker array must not be returned')
  // Protected broker columns and account contact details never leak.
  assert.ok(!/userId:|phone:|email:|officeAddress:/.test(source), 'protected broker fields must not leak from the featured feed')
})

// =============================================================
// H2 — Broker update mass assignment / ownership transfer
// =============================================================

test('H2: allowlist keeps legitimate broker-editable fields', () => {
  const body: Record<string, unknown> = {
    displayName: 'New Name',
    companyName: 'New Co',
    description: 'desc',
    profileSlug: 'new-slug',
    phone: '+1-555-0000',
    whatsapp: '+1-555-0000',
    email: 'n@x.com',
    website: 'https://x.com',
    officeAddress: 'Addr',
    city: 'Dallas',
    state: 'TX',
    pinCode: '75201',
    experienceYears: 5,
    registrationNumber: 'RN1',
    panNumber: 'PN1',
    logo: '/logo.png',
    coverImage: '/cover.png',
    isVisible: true,
  }
  const picked = pickBrokerEditableFields(body, false)
  for (const key of Object.keys(body).filter((key) => key !== 'isVisible')) {
    assert.equal(picked[key], body[key], `editable field ${key} must be applied`)
  }
  assert.equal(picked.isVisible, undefined, 'visibility must remain admin-only')
})

test('H2: non-admin cannot set ownership, status, metrics, or verification fields', () => {
  const body = {
    userId: 'u-victim',
    brokerStatus: 'FEATURED',
    verificationStatus: 'VERIFIED',
    featuredRank: 1,
    verifiedAt: new Date().toISOString(),
    avgRating: 5,
    totalLeads: 999,
    profileViews: 999,
    creationSource: 'SELF_REGISTERED',
    subscription: 'FEATURED',
    verificationDocuments: ['x'],
    displayName: 'Allowed Edit',
  }
  const picked = pickBrokerEditableFields(body, false)
  for (const field of ['userId', 'brokerStatus', 'verificationStatus', 'featuredRank', 'verifiedAt', 'avgRating', 'totalLeads', 'profileViews', 'creationSource', 'subscription', 'verificationDocuments']) {
    assert.equal(picked[field], undefined, `field ${field} must be rejected for a broker`)
  }
  assert.equal(picked.displayName, 'Allowed Edit', 'legitimate edits must still pass')
})

test('H2: admin may set admin-managed fields but never ownership/metrics', () => {
  const picked = pickBrokerEditableFields({
    userId: 'u-victim',
    brokerStatus: 'FEATURED',
    verificationStatus: 'VERIFIED',
    featuredRank: 3,
    avgRating: 5,
    totalLeads: 999,
    profileViews: 999,
    displayName: 'Admin Edit',
  }, true)
  assert.equal(picked.brokerStatus, 'FEATURED', 'admin can manage status')
  assert.equal(picked.verificationStatus, 'VERIFIED', 'admin can manage verification')
  assert.equal(picked.featuredRank, 3, 'admin can manage rank')
  assert.equal(picked.isVisible, undefined, 'visibility is not present in this admin test payload')
  assert.equal(picked.userId, undefined, 'admin must not transfer ownership via PATCH')
  assert.equal(picked.avgRating, undefined, 'admin must not hand-set metrics')
  assert.equal(picked.totalLeads, undefined, 'admin must not hand-set metrics')
  assert.equal(picked.profileViews, undefined, 'admin must not hand-set metrics')
})

test('H2: allowlist constants are canonical (no privileged field is editable by brokers)', () => {
  for (const field of ['userId', 'avgRating', 'totalLeads', 'profileViews', 'brokerStatus', 'verificationStatus', 'featuredRank', 'verifiedAt', 'creationSource', 'id']) {
    assert.equal((BROKER_EDITABLE_FIELDS as readonly string[]).includes(field), false, `${field} must not be broker-editable`)
  }
  assert.ok(BROKER_EDITABLE_FIELDS.length > 0, 'editable allowlist must exist')
   assert.ok(BROKER_ADMIN_FIELDS.includes('verificationStatus'), 'admin allowlist includes verification')
   assert.ok(BROKER_ADMIN_FIELDS.includes('isVisible'), 'admin allowlist includes visibility')
})

test('H2: PATCH routes use the allowlist helper and preserve the ownership check', () => {
  for (const file of ['app/api/brokers/[id]/route.ts', 'app/api/company/[slug]/route.ts']) {
    const source = read(file)
    assert.ok(source.includes('pickBrokerEditableFields('), `${file} must use the canonical allowlist helper`)
    assert.equal(/restrictedFields|adminRestrictedFields/.test(source), false, `${file} must not use a blacklist`)
    assert.ok(source.includes('broker.userId !== currentUser.id'), `${file} must preserve the ownership check`)
    assert.ok(source.includes('403'), `${file} must reject non-owners with 403`)
  }
})

// =============================================================
// H3 — Password recovery
// =============================================================

test('H3: reset email points to the real reset-password route with the token', () => {
  const source = read('actions/email.action.ts')
  assert.ok(source.includes('/auth/reset-password?token=${rawToken}'), 'reset link must target /auth/reset-password')
  assert.ok(source.includes('email=${encodeURIComponent(normalizedEmail)}'), 'normalized email must remain in the link')
})

test('H3: raw reset token is never logged', () => {
  const source = read('actions/email.action.ts')
  assert.equal(source.includes('Reset URL generated'), false, 'must not log the reset URL (contains the raw token)')
  assert.equal(source.includes('Email send result'), false, 'must not log the email send result')
})

test('H3: reset-password endpoint validates a hashed token, expiry, and bcrypt', () => {
  const source = read('app/api/auth/reset-password/route.ts')
  assert.ok(source.includes("createHash('sha256')"), 'token must be hashed before comparison')
  assert.ok(source.includes('resetPasswordTokenExpiry'), 'expiry must be enforced')
  assert.ok(source.includes('Invalid or expired reset token'), 'invalid token must be rejected')
  assert.ok(source.includes('Reset token has expired'), 'expired token must be rejected')
  assert.ok(source.includes('hashPassword(password)'), 'password hashing must remain intact (canonical helper)')
  assert.ok(source.includes('resetPasswordToken: null'), 'token must be consumed after use')
})
