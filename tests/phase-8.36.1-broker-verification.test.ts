import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const adminPatch = read('app/api/admin/brokers/[id]/route.ts')
const brokerPatch = read('app/api/brokers/[id]/route.ts')
const verificationLib = read('lib/broker-verification.ts')
const emailTemplates = read('lib/email-templates.ts')
const finalize = read('lib/broker-registration.ts')
const adminDefaults = read('lib/admin-broker.ts')
const dashboard = read('components/sections/broker/BrokerDashboard.tsx')
const adminActions = read('app/admin/brokers/[id]/AdminBrokerActions.tsx')

// ===========================================================================
// PHASE 8.36.1 — BROKER VERIFICATION WORKFLOW
// ===========================================================================

test('SELF_REGISTERED brokers are created UNVERIFIED; ADMIN_CREATED brokers are created VERIFIED', () => {
  assert.match(finalize, /verificationStatus: 'UNVERIFIED'/)
  assert.match(adminDefaults, /verificationStatus: 'VERIFIED' as const/)
})

test('admin verification is ADMIN-only on both broker PATCH routes', () => {
  assert.match(adminPatch, /admin\?\.role !== 'ADMIN'/)
  assert.match(adminPatch, /admin\?\.role !== 'ADMIN'/)
  // Broker-facing PATCH only applies verification handling inside an admin branch.
  assert.match(brokerPatch, /if \(currentUser\.isAdmin\)/)
  assert.match(brokerPatch, /pickBrokerEditableFields\(body, currentUser\.isAdmin\)/)
})

test('verifiedAt is set on VERIFIED (if null), cleared on UNVERIFIED, preserved on unrelated saves', () => {
  assert.match(verificationLib, /verifiedAt: current\.verifiedAt \?\? new Date\(\)/)
  assert.match(verificationLib, /verificationStatus: 'UNVERIFIED', verifiedAt: null/)
  // isVisible is never touched by the verification helpers' update objects.
  assert.doesNotMatch(verificationLib, /isVisible\s*[:=]/)
  // Both admin routes consume the shared helper.
  assert.match(adminPatch, /buildVerificationUpdate/)
  assert.match(brokerPatch, /buildVerificationUpdate/)
})

test('UNVERIFIED -> VERIFIED sends exactly one verification email (idempotency-scoped, fire-and-forget)', () => {
  assert.match(verificationLib, /wasVerifiedTransition/)
  assert.match(verificationLib, /currentStatus !== 'VERIFIED' && target === 'VERIFIED'/)
  assert.match(verificationLib, /idempotencyKey: `broker_verified_\$\{params\.profileSlug\}`/)
  // Email is fire-and-forget and never rolls back the DB verification.
  assert.match(verificationLib, /never rolls back the already-persisted DB verification/)
  assert.match(verificationLib, /Failed to send broker verification email \(verification already persisted\)/)
  // Only the actual transition triggers the send on both routes.
  assert.match(adminPatch, /transitionedToVerified/)
  assert.match(brokerPatch, /transitionedToVerified/)
})

test('verification email template reflects the isVisible dependency', () => {
  assert.match(emailTemplates, /subject: 'Your HomeLoanMarket mortgage originator account is verified'/)
  assert.match(emailTemplates, /when your profile is set to visible/)
})

test('broker dashboard shows Verification Under Review and keeps the header Verified badge from authoritative state', () => {
  assert.match(dashboard, /Verification Under Review/)
  // The redundant "Account Verified" success card was removed (Phase 8.36.7);
  // the verified state is communicated by the header "Verified" badge.
  assert.doesNotMatch(dashboard, /Account Verified/)
  assert.match(dashboard, /Verified/)
  assert.match(dashboard, /creationSource === 'SELF_REGISTERED'/)
  assert.match(dashboard, /verificationStatus === 'VERIFIED'/)
  assert.doesNotMatch(dashboard, /localStorage/)
})

test('admin broker detail exposes a clear Verify Broker action', () => {
  assert.match(adminActions, /Verify Broker/)
  // The verify action is a dedicated button wired to the canonical admin PATCH,
  // not a checkbox buried in the profile-edit form.
  assert.match(adminActions, /verifyBroker\(\)/)
  assert.match(adminActions, /body: JSON\.stringify\(\{ verificationStatus: 'VERIFIED' \}\)/)
  assert.match(adminActions, /isSelfRegistered && !isVerified/)
  assert.match(adminActions, /does not change publication \(isVisible\)/)
})