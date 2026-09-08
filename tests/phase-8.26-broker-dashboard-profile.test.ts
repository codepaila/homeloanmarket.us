import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ---------------------------------------------------------------------------
// Phase 8.26 — Broker dashboard + company profile redesign
//
// The broker-facing dashboard and company profile are professional profile-
// management surfaces. They must never surface ratings, reviews, leads,
// contact messages, bank partnerships, registration/tax identifiers, cover
// images, or fabricated CRM-style metrics. The fields may still exist in the
// database and in admin/public surfaces, but must not be wired into the
// broker-facing UI or the broker-facing DTO payloads.
// ---------------------------------------------------------------------------

const FORBIDDEN_DTO_FIELDS = [
  'coverImage',
  'registrationNumber',
  'panNumber',
  'avgRating',
  'totalReviews',
  'totalLeads',
  'profileViews',
  'monthlyLeads',
  'bankPartners',
  'reviews',
  'successRate',
  'responseRate',
  'avgProcessingTime',
  'totalLoansProcessed',
  'verifiedAt',
]

// ---------------------- Owner DTO ----------------------

test('toBrokerOwnerDto excludes all broker-facing forbidden fields', () => {
  const dto = read('lib/broker-owner-dto.ts')
  for (const field of FORBIDDEN_DTO_FIELDS) {
    assert.doesNotMatch(dto, new RegExp(`\\b${field}\\b`), `broker-owner DTO must not carry ${field}`)
  }
})

test('toBrokerOwnerDto keeps legitimate professional identity fields', () => {
  const dto = read('lib/broker-owner-dto.ts')
  assert.match(dto, /displayName: broker\.displayName/)
  assert.match(dto, /nmls: broker\.nmls/)
  assert.match(dto, /licenseStates: broker\.licenseStates/)
  assert.match(dto, /brokerStatus: broker\.brokerStatus/)
  assert.match(dto, /subscription:/)
})

// ---------------------- Dashboard page ----------------------

test('broker dashboard page fetches no contact messages or analytics', () => {
  const page = read('app/broker/dashboard/page.tsx')
  assert.doesNotMatch(page, /prisma\.contactMessage/)
  assert.doesNotMatch(page, /contactMessage\.findMany/)
  assert.doesNotMatch(page, /contactMessage\.aggregate/)
  assert.doesNotMatch(page, /monthlyLeads/)
  assert.doesNotMatch(page, /analytics/)
  assert.match(page, /toBrokerOwnerDto\(user\.brokerProfile\)/)
  assert.match(page, /BrokerDashboard initialData=\{initialData\}/)
  assert.match(page, /DeleteAccountDialog/)
  assert.match(page, /\/api\/account\/broker/)
})

// ---------------------- BrokerDashboard component ----------------------

test('BrokerDashboard renders no rating/review/lead/message/analytics/cover data', () => {
  const dashboard = read('components/sections/broker/BrokerDashboard.tsx')
  for (const token of [
    'avgRating',
    'totalReviews',
    'totalLeads',
    'profileViews',
    'contactMessages',
    'contactStats',
    'useMyContactMessages',
    'useDashboardStats',
    'coverImage',
    'reviews',
    'requiresSubscription',
    'analytics',
    'Client Satisfaction',
    'Response Rate',
    'avgResponseTime',
    'bankPartners',
    'successRate',
    'responseRate',
    'totalLoansProcessed',
  ]) {
    assert.doesNotMatch(dashboard, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `BrokerDashboard must not render ${token}`)
  }
})

test('BrokerDashboard surfaces broker verification status from the authoritative record', () => {
  const dashboard = read('components/sections/broker/BrokerDashboard.tsx')
  assert.match(dashboard, /currentBroker\.verificationStatus === 'VERIFIED'/)
  assert.match(dashboard, /creationSource === 'SELF_REGISTERED'/)
  assert.doesNotMatch(dashboard, /localStorage/)
})

test('BrokerDashboard keeps professional status labels', () => {
  const dashboard = read('components/sections/broker/BrokerDashboard.tsx')
  assert.match(dashboard, /label:\s*"Mortgage Expert"/)
  assert.match(dashboard, /useMyBrokerProfile/)
  assert.match(dashboard, /initialData/)
})

// ---------------------- BrokerProfile component + company page ----------------------

test('BrokerProfile renders no bank partners, reviews, views, cover, verification, or fabricated metrics', () => {
  const profile = read('components/sections/broker/BrokerProfile.tsx')
  for (const token of [
    'profileViews',
    'monthlyLeads',
    'coverImage',
    'bankPartners',
    'reviews',
    'rating',
    'Performance Metrics',
    'Bank Partnerships',
    'successRate',
    'responseRate',
    'avgProcessingTime',
    'totalLoansProcessed',
    'verificationStatus',
    'Verification Status',
    'Complete Verification',
    'Verified Mortgage Originator',
    '/broker/profile/verification',
  ]) {
    assert.doesNotMatch(profile, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `BrokerProfile must not render ${token}`)
  }
})

test('BrokerProfile keeps useful identity, contact, professional and subscription info', () => {
  const profile = read('components/sections/broker/BrokerProfile.tsx')
  assert.match(profile, /displayName/)
  assert.match(profile, /companyName/)
  assert.match(profile, /Contact Information/)
  assert.match(profile, /Phone/)
  assert.match(profile, /Email/)
  assert.match(profile, /WhatsApp/)
  assert.match(profile, /Professional Details/)
  assert.match(profile, /Years of Experience/)
  assert.match(profile, /NMLS ID/)
  assert.match(profile, /Licensed States/)
  assert.match(profile, /US_STATES/)
  assert.match(profile, /Subscription Status/)
  assert.match(profile, /View Public Profile/)
  assert.match(profile, /Edit Profile/)
  assert.match(profile, /label:\s*"Mortgage Expert"/)
})

test('company profile page derives its view from the trimmed owner DTO only', () => {
  const page = read('app/broker/company/page.tsx')
  assert.match(page, /toBrokerOwnerDto\(broker\)/)
  for (const field of [
    'bankPartners',
    'reviews',
    'contactMessages',
    'monthlyLeads',
    'successRate',
    'responseRate',
    'avgProcessingTime',
    'totalLoansProcessed',
    'registrationNumber',
    'panNumber',
    'coverImage',
    'profileViews',
  ]) {
    assert.doesNotMatch(page, new RegExp(`\\b${field}\\b`), `company profile page must not reference ${field}`)
  }
})

// ---------------------- Edit forms ----------------------

test('company edit page DTO excludes cover image and registration/tax identifiers', () => {
  const page = read('app/broker/company/edit/page.tsx')
  assert.match(page, /socialLinks: brokerProfile\.socialLinks/)
  assert.doesNotMatch(page, /coverImage/)
  assert.doesNotMatch(page, /registrationNumber/)
  assert.doesNotMatch(page, /panNumber/)
  assert.doesNotMatch(page, /verificationStatus/)
})

test('broker edit form has no cover-image upload, no registration/tax fields, no verification block', () => {
  const form = read('components/sections/broker/EditProfile.tsx')
  assert.doesNotMatch(form, /CoverImageUpload/)
  assert.doesNotMatch(form, /cover-image/)
  assert.doesNotMatch(form, /registrationNumber/)
  assert.doesNotMatch(form, /panNumber/)
  assert.doesNotMatch(form, /verificationStatus/)
  assert.doesNotMatch(form, /Complete Verification/)
  assert.doesNotMatch(form, /\/broker\/profile\/verification/)
  assert.match(form, /\/api\/brokers\/me\/profile-image/)
  assert.match(form, /USLocationPicker/)
})

// ---------------------- Broker API ----------------------

test('GET /api/brokers/me returns no bank partners or reviews relations', () => {
  const route = read('app/api/brokers/me/route.ts')
  assert.match(route, /toBrokerOwnerDto\(broker\)/)
  assert.doesNotMatch(route, /bankPartners:/)
  assert.doesNotMatch(route, /reviews:/)
  assert.match(route, /getCurrentUser/)
  assert.match(route, /currentUser\.role !== 'BROKER'/)
})

test('broker PATCH /api/brokers/me no longer manages bank partnerships', () => {
  const route = read('app/api/brokers/me/route.ts')
  assert.doesNotMatch(route, /bankPartnerships !== undefined/)
  assert.doesNotMatch(route, /brokerBank\.deleteMany/)
  assert.doesNotMatch(route, /brokerBank\.createMany/)
})

// ---------------------- Sidebar serialization ----------------------

test('broker sidebar data no longer serializes rating/leads/views counters', () => {
  const sidebar = read('components/layout/admin/sideBarData.ts')
  const block = sidebar.slice(sidebar.indexOf('// Broker specific'), sidebar.indexOf('// Subscription info'))
  assert.doesNotMatch(block, /avgRating/)
  assert.doesNotMatch(block, /totalReviews/)
  assert.doesNotMatch(block, /totalLeads/)
  assert.doesNotMatch(block, /profileViews/)
  assert.match(block, /profileSlug/)
})

// ---------------------- Legitimate surfaces remain intact ----------------------

test('admin and public surfaces still carry the metrics fields', () => {
  const publicPage = read('app/(public)/brokers/page.tsx')
  assert.match(publicPage, /avgRating/)
  const brokerIdRoute = read('app/api/brokers/[id]/route.ts')
  assert.match(brokerIdRoute, /totalLeads/)
  const adminRoute = read('app/api/admin/brokers/route.ts')
  assert.match(adminRoute, /registrationNumber/)
})

test('legitimate broker messages page still uses the contact messages hook', () => {
  const messagesPage = read('app/broker/messages/page.tsx')
  assert.match(messagesPage, /useMyContactMessages/)
})

test('onboarding wizard keeps its registration/tax/cover fields server-side', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.match(wizard, /registrationNumber: data\.registrationNumber/)
  assert.match(wizard, /panNumber: data\.panNumber/)
  assert.match(wizard, /coverImage: data\.coverImage/)
})