import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const page = read('app/admin/brokers/[id]/page.tsx')
const actions = read('app/admin/brokers/[id]/AdminBrokerActions.tsx')
const adminPatch = read('app/api/admin/brokers/[id]/route.ts')
const verificationLib = read('lib/broker-verification.ts')

// ===========================================================================
// PHASE 8.36.2 — ADMIN BROKER DETAIL VERIFICATION READ + UPDATE
// ===========================================================================

test('detail page passes canonical verification fields to AdminBrokerActions', () => {
  assert.match(page, /verificationStatus: broker\.verificationStatus/)
  assert.match(page, /verifiedAt: broker\.verifiedAt \? broker\.verifiedAt\.toISOString\(\) : null/)
  assert.match(page, /creationSource: broker\.creationSource/)
  assert.match(page, /brokerStatus: broker\.brokerStatus/)
  assert.match(page, /<AdminBrokerActions broker=\{brokerDto\} \/>/)
})

test('AdminBrokerActions consumes verificationStatus, verifiedAt, creationSource, brokerStatus', () => {
  assert.match(actions, /verificationStatus: string/)
  assert.match(actions, /verifiedAt\?: string \| Date \| null/)
  assert.match(actions, /creationSource\?: string \| null/)
  assert.match(actions, /brokerStatus\?: string/)
  assert.match(actions, /useState\(broker\.verificationStatus\)/)
  assert.match(actions, /verifiedAt \? new Date\(broker\.verifiedAt\)\.toISOString\(\) : null/)
})

test('Verify Broker button appears only for SELF_REGISTERED + UNVERIFIED', () => {
  assert.match(actions, /isSelfRegistered && !isVerified/)
  assert.match(actions, /Verify Broker/)
  // ADMIN_CREATED brokers are verified by construction and never get an active
  // verify action.
  assert.match(actions, /isSelfRegistered = broker\.creationSource === 'SELF_REGISTERED'/)
})

test('verified state is not presented as an active Verify action', () => {
  assert.match(actions, /isVerified = verificationStatus === 'VERIFIED'/)
  // The Verify button is only rendered when self-registered AND not verified.
  assert.match(actions, /isSelfRegistered && !isVerified/)
  assert.match(actions, /disabled=\{verifying \|\| saving\}/)
})

test('Verify action calls the existing canonical admin update endpoint with only the verification field', () => {
  assert.match(actions, /fetch\(`\/api\/admin\/brokers\/\$\{broker\.id\}`/)
  assert.match(actions, /body: JSON\.stringify\(\{ verificationStatus: 'VERIFIED' \}\)/)
})

test('successful verification updates local state (immediate UI, no stale client state)', () => {
  assert.match(actions, /setVerificationStatus\('VERIFIED'\)/)
  assert.match(actions, /setVerifiedAt\(data\.broker\.verifiedAt/)
  assert.match(actions, /router\.refresh\(\)/)
  assert.doesNotMatch(actions, /useEffect/)
})

test('admin PATCH route remains the single verification write path and rejects non-admins', () => {
  assert.match(adminPatch, /admin\?\.role !== 'ADMIN'/)
  assert.match(adminPatch, /buildVerificationUpdate/)
  assert.match(adminPatch, /wasVerifiedTransition/)
})

test('duplicate verification does not send another email (transition-only + idempotency key)', () => {
  assert.match(verificationLib, /currentStatus !== 'VERIFIED' && target === 'VERIFIED'/)
  assert.match(verificationLib, /idempotencyKey: `broker_verified_\$\{params\.profileSlug\}`/)
  assert.match(adminPatch, /if \(transitionedToVerified\)/)
})

test('verification does not modify isVisible, subscription, or ranking', () => {
  // AdminBrokerActions sends only verificationStatus for the verify action.
  assert.match(actions, /JSON\.stringify\(\{ verificationStatus: 'VERIFIED' \}\)/)
  // The backend verification helper never touches isVisible.
  assert.doesNotMatch(verificationLib, /isVisible\s*[:=]/)
  // Admin PATCH preserves isVisible when verifying (it is only set if sent).
  assert.match(adminPatch, /'isVisible'/)
  // Ranking is unchanged by verification (no tier writes in the verify path).
  assert.doesNotMatch(verificationLib, /featuredRank/)
})