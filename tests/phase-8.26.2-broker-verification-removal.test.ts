import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ---------------------------------------------------------------------------
// Phase 8.26.2 — Broker-facing verification presentation removal
//
// The broker dashboard/profile surface must not present broker verification
// status to the broker. verificationStatus remains a real backend value (it is
// display metadata and an admin-verification workflow marker), but it is not
// shown to the broker and not shipped in the broker-owner DTO payload. The
// /broker/profile/verification route never existed — it was a dangling link.
//
// Phase 8.28.1 supersedes one piece of the original backend preservation:
// public marketplace eligibility no longer depends on verification or
// creationSource (a complete, visible, non-suspended, properly-owned profile is
// public). The enum, schema default, and admin verification workflow remain.
// ---------------------------------------------------------------------------

// ---------------------- BrokerProfile ----------------------

test('BrokerProfile has no verification card, badge, config or link', () => {
  const profile = read('components/sections/broker/BrokerProfile.tsx')
  for (const token of [
    'verificationStatusConfig',
    'verificationStatus',
    'Verification',
    'Unverified',
    'Pending Verification',
    'Verified Mortgage Originator',
    'Complete Verification',
    '/broker/profile/verification',
  ]) {
    assert.doesNotMatch(profile, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `BrokerProfile must not contain ${token}`)
  }
})

test('BrokerProfile keeps subscription and legitimate status config', () => {
  const profile = read('components/sections/broker/BrokerProfile.tsx')
  assert.match(profile, /Subscription Status/)
  assert.match(profile, /label:\s*"Mortgage Expert"/)
  assert.match(profile, /SUSPENDED/)
  assert.match(profile, /FREE/)
})

// ---------------------- BrokerDashboard ----------------------

test('BrokerDashboard has no verification status presentation', () => {
  const dashboard = read('components/sections/broker/BrokerDashboard.tsx')
  for (const token of [
    'verificationStatusConfig',
    'verificationStatus',
    'Verification Status',
    'Verify Profile',
    'Complete Verification',
  ]) {
    assert.doesNotMatch(dashboard, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `BrokerDashboard must not contain ${token}`)
  }
})

test('BrokerDashboard keeps plan, professional, contact and email-verification flow', () => {
  const dashboard = read('components/sections/broker/BrokerDashboard.tsx')
  assert.match(dashboard, /label:\s*"Mortgage Expert"/)
  assert.match(dashboard, /handleResendVerification/)
  assert.match(dashboard, /resend-verification/)
  assert.match(dashboard, /NMLS ID/)
  assert.match(dashboard, /US_STATES/)
  assert.match(dashboard, /Profile Completeness/)
})

// ---------------------- EditProfile ----------------------

test('EditProfile has no verification block or dangling verification link', () => {
  const form = read('components/sections/broker/EditProfile.tsx')
  for (const token of [
    'verificationStatus',
    'Verification Status',
    'Complete Verification',
    '/broker/profile/verification',
  ]) {
    assert.doesNotMatch(form, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `EditProfile must not contain ${token}`)
  }
})

test('EditProfile still exposes profile-visibility switch (legit account control)', () => {
  const form = read('components/sections/broker/EditProfile.tsx')
  assert.match(form, /Profile Visibility/)
  assert.match(form, /isVisible/)
})

// ---------------------- Owner DTO ----------------------

test('broker-owner DTO no longer ships verificationStatus or verifiedAt', () => {
  const dto = read('lib/broker-owner-dto.ts')
  assert.doesNotMatch(dto, /verificationStatus/)
  assert.doesNotMatch(dto, /verifiedAt/)
  assert.match(dto, /brokerStatus: broker\.brokerStatus/)
})

// ---------------------- Company edit page DTO ----------------------

test('company edit page DTO no longer ships verificationStatus', () => {
  const page = read('app/broker/company/edit/page.tsx')
  assert.doesNotMatch(page, /verificationStatus/)
  assert.match(page, /socialLinks: brokerProfile\.socialLinks/)
})

// ---------------------- Backend preservation ----------------------

test('verificationStatus survives as display metadata and admin filter in backend listing and geo', () => {
  const listing = read('lib/broker-listing.ts')
  assert.match(listing, /verificationStatus: input\.verificationStatus/)
  const featuredRoute = read('app/api/brokers/featured/route.ts')
  assert.match(featuredRoute, /verificationStatus: broker\.verificationStatus/)
})

test('public eligibility no longer gates on verification or creationSource', () => {
  const listing = read('lib/broker-listing.ts')
  const geo = read('lib/location/broker-geo.ts')
  const policy = read('lib/broker-policy.ts')
  assert.doesNotMatch(listing, /verificationStatus: 'VERIFIED'/)
  assert.doesNotMatch(listing, /creationSource: 'ADMIN_CREATED'/)
  assert.doesNotMatch(geo, /verificationStatus: 'VERIFIED'/)
  assert.doesNotMatch(geo, /creationSource: 'ADMIN_CREATED'/)
  assert.doesNotMatch(policy, /sourceEligible/)
})

test('admin verification workflow remains intact', () => {
  const adminRoute = read('app/api/admin/brokers/[id]/route.ts')
  assert.match(adminRoute, /\['UNVERIFIED', 'VERIFIED'\]/)
  assert.match(adminRoute, /'Invalid verification status'/)
  const adminData = read('lib/admin/broker-data.ts')
  assert.match(adminData, /verificationStatus/)
  const publicBrokerIdRoute = read('app/api/brokers/[id]/route.ts')
  assert.match(publicBrokerIdRoute, /verifiedAt/)
})

test('public-profile and sitemap verification behavior remains intact', () => {
  const publicPage = read('app/(public)/brokers/page.tsx')
  assert.match(publicPage, /avgRating/)
  const sitemap = read('app/sitemap.ts')
  assert.match(sitemap, /verificationStatus/)
  assert.match(sitemap, /publicBrokerWhere\(\)/)
})

// ---------------------- Regression: active surfaces ----------------------

test('broker company page still loads BrokerProfile from the owner DTO', () => {
  const page = read('app/broker/company/page.tsx')
  assert.match(page, /BrokerProfile/)
  assert.match(page, /toBrokerOwnerDto\(broker\)/)
  assert.doesNotMatch(page, /contactMessages/)
  assert.doesNotMatch(page, /monthlyLeads/)
})

test('broker dashboard page still loads BrokerDashboard with owner DTO', () => {
  const page = read('app/broker/dashboard/page.tsx')
  assert.match(page, /toBrokerOwnerDto\(user\.brokerProfile\)/)
  assert.match(page, /DeleteAccountDialog/)
  assert.doesNotMatch(page, /prisma\.contactMessage/)
})

test('setup wizard retains its registration/tax fields server-side only', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.match(wizard, /registrationNumber: data\.registrationNumber/)
  assert.match(wizard, /panNumber: data\.panNumber/)
  assert.match(wizard, /coverImage: data\.coverImage/)
})

test('legitimate broker messages page still intact', () => {
  const messagesPage = read('app/broker/messages/page.tsx')
  assert.match(messagesPage, /useMyContactMessages/)
})