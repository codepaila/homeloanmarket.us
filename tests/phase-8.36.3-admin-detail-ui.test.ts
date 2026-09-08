import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const page = read('app/admin/brokers/[id]/page.tsx')
const actions = read('app/admin/brokers/[id]/AdminBrokerActions.tsx')
const mortgage = read('app/admin/brokers/[id]/MortgageExpertControl.tsx')

// ===========================================================================
// PHASE 8.36.3 — ADMIN BROKER DETAIL UI/UX REFINEMENT
// ===========================================================================

test('page header establishes identity, state, and navigation', () => {
  assert.match(page, /Back to Brokers/)
  assert.match(page, /<ArrowLeft/)
  assert.match(page, /\{broker\.companyName \|\| broker\.displayName\}/)
  assert.match(page, /\{broker\.profileSlug\}/)
  assert.match(page, /Suspended/)
  assert.match(page, /Published/)
})

test('summary cards give a consistent quick snapshot', () => {
  assert.match(page, /'Ownership'/)
  assert.match(page, /'Source'/)
  assert.match(page, /'Verification'/)
  assert.match(page, /'Subscription'/)
  assert.match(page, /'Visibility'/)
  assert.match(page, /grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5/)
  // Equal, compact card styling (no duplicated verbose detail).
  assert.match(page, /truncate text-sm font-semibold/)
})

test('profile form groups fields into logical sections', () => {
  assert.match(actions, /Identity/)
  assert.match(actions, /Contact/)
  assert.match(actions, /Office location/)
  assert.match(actions, /Professional/)
  assert.match(actions, /Public profile/)
  // Two-column responsive grid for fields.
  assert.match(actions, /grid gap-4 sm:grid-cols-2/)
  // Save action is associated with the profile form.
  assert.match(actions, /Save changes/)
})

test('profile media is compact and side-by-side', () => {
  assert.match(actions, /ProfileImageUpload/)
  assert.match(actions, /CoverImageUpload/)
  assert.match(actions, /grid gap-4 sm:grid-cols-2/)
})

test('verification is a distinct sidebar section with a clear Verify Broker action', () => {
  assert.match(actions, /Broker Verification|>Verification</)
  assert.match(actions, /Under Review/)
  assert.match(actions, /Verified At/)
  assert.match(actions, /isSelfRegistered && !isVerified/)
  assert.match(actions, /Verify Broker/)
  // Verification is NOT inside the profile form anymore.
  assert.match(actions, /<section className="space-y-3 rounded border bg-card p-5">/)
})

test('publication is a separate concern from verification', () => {
  assert.match(actions, />Publication</)
  assert.match(actions, /Controls whether this broker profile is publicly listed\./)
  assert.match(actions, /Publication is independent of verification/)
  // Publication uses the canonical admin PATCH with only isVisible.
  assert.match(actions, /body: JSON\.stringify\(\{ isVisible: next \}\)/)
  // Verify payload does not include isVisible.
  assert.match(actions, /JSON\.stringify\(\{ verificationStatus: 'VERIFIED' \}\)/)
})

test('location section shows resolved state or a resolve prompt', () => {
  assert.match(actions, />Location</)
  assert.match(actions, /broker\.normalizedAddress \?/)
  assert.match(actions, /Location needs to be resolved before radius search\./)
  assert.match(actions, /Resolve Location/)
})

test('ownership / claim readiness is a clear sidebar section', () => {
  assert.match(actions, />Ownership</)
  assert.match(actions, /broker\.userId \? 'Owned' : 'Unowned'/)
  assert.match(actions, /Send invitation|Resend invitation/)
  assert.match(actions, /Invitation recipient/)
})

test('danger zone is clearly isolated', () => {
  assert.match(actions, /Danger zone/)
  assert.match(actions, /border-destructive\/30/)
  assert.match(actions, /Delete broker/)
})

test('Mortgage Expert section is compact and separates subscription vs admin badge', () => {
  assert.match(mortgage, /Subscription qualification/)
  assert.match(mortgage, /Admin badge/)
  assert.match(mortgage, /Automatically qualified/)
  assert.match(mortgage, /text-success/)
  assert.doesNotMatch(mortgage, /text-emerald-600/)
  assert.match(mortgage, /Independent of the broker/)
})

test('verification does not modify publication / isVisible flow', () => {
  // The verify action sends only verificationStatus.
  assert.match(actions, /JSON\.stringify\(\{ verificationStatus: 'VERIFIED' \}\)/)
  // The publication action sends only isVisible.
  assert.match(actions, /JSON\.stringify\(\{ isVisible: next \}\)/)
  assert.doesNotMatch(actions, /verificationStatus: 'VERIFIED'[\s\S]{0,80}isVisible/)
})