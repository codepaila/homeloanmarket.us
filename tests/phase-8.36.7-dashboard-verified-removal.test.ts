import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const dashboard = read('components/sections/broker/BrokerDashboard.tsx')

// ===========================================================================
// PHASE 8.36.7 — REMOVE BROKER DASHBOARD "ACCOUNT VERIFIED" SUCCESS MESSAGE
// ===========================================================================

test('dashboard no longer renders the "Account Verified" success card', () => {
  assert.doesNotMatch(dashboard, /Account Verified/)
  assert.doesNotMatch(dashboard, /Your broker account has been successfully verified/)
})

test('dashboard still shows "Verification Under Review" for self-registered unverified brokers', () => {
  assert.match(dashboard, /Verification Under Review/)
  assert.match(dashboard, /being reviewed by our team/)
  // The Under Review card is gated to SELF_REGISTERED + not verified.
  assert.match(dashboard, /creationSource === 'SELF_REGISTERED' && currentBroker\.verificationStatus !== 'VERIFIED'/)
})

test('verified state remains communicated by the header "Verified" badge', () => {
  assert.match(dashboard, /Verified/)
  assert.match(dashboard, /currentBroker\.verificationStatus === 'VERIFIED' && \(/)
})

test('no new verification state/store was introduced for the removal', () => {
  assert.doesNotMatch(dashboard, /localStorage/)
  assert.doesNotMatch(dashboard, /verificationStatusConfig/)
  assert.doesNotMatch(dashboard, /createContext/)
  assert.doesNotMatch(dashboard, /sessionStorage/)
})