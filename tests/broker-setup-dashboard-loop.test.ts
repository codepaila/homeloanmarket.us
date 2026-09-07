import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const dashboard = fs.readFileSync('app/broker/dashboard/page.tsx', 'utf8')
const setup = fs.readFileSync('app/setup/page.tsx', 'utf8')
const status = fs.readFileSync('app/api/broker-registration/status/route.ts', 'utf8')
const wizard = fs.readFileSync('components/sections/broker/BrokerSetupWizard.tsx', 'utf8')
const state = fs.readFileSync('lib/broker-onboarding-state.ts', 'utf8')

test('one authoritative state machine drives both setup and dashboard', () => {
  // /setup and /broker/dashboard must both route through the SAME function so
  // they can never disagree about whether onboarding is complete (the cause of
  // the historical setup <-> dashboard redirect loop).
  assert.match(dashboard, /resolveBrokerOnboardingDestination\(user, '\/broker\/dashboard'\)/)
  assert.match(setup, /resolveBrokerOnboardingDestination\(user, '\/setup'\)/)
  assert.match(state, /export function resolveBrokerOnboardingDestination/)
  assert.match(state, /COMPLETED/)
  assert.match(state, /ONBOARDING_IN_PROGRESS/)
  assert.match(state, /SUBSCRIPTION_PENDING/)
  assert.match(state, /NOT_STARTED/)
})

test('completed state is Broker-profile existence in the shared machine', () => {
  assert.match(state, /Boolean\(user\.brokerProfile\)/)
  assert.match(state, /isBrokerSetupComplete\(user\)/)
  assert.match(state, /'\/broker\/dashboard'/)
})

test('/setup renders only for incomplete brokers and never decides completion on the client', () => {
  // /setup must be server-rendered: it reads getCurrentUser() and redirects via
  // the shared machine instead of fetching a status API and calling
  // router.push('/broker/dashboard') from the client.
  assert.match(setup, /getCurrentUser\(\)/)
  assert.match(setup, /redirect\(destination\)/)
  assert.doesNotMatch(setup, /fetch\('\/api\/broker-registration\/status'\)/)
  assert.doesNotMatch(setup, /router\.push\('\/broker\/dashboard'\)/)
  assert.doesNotMatch(setup, /useSession\(\)/)
})

test('dashboard redirects incomplete brokers via the shared machine (subscription-pending to plans, else setup)', () => {
  assert.match(dashboard, /if \(!isBrokerSetupComplete\(user\)\)/)
  assert.match(dashboard, /resolveBrokerOnboardingDestination\(user, '\/broker\/dashboard'\)/)
  assert.match(dashboard, /redirect\(destination \?\? '\/setup'\)/)
})

test('/setup restores the saved server-side draft on every render (reload-safe)', () => {
  assert.match(setup, /brokerRegistration\?\.draft/)
  assert.match(setup, /initialData/)
  assert.match(setup, /initialStep/)
  assert.match(setup, /BrokerSetupWizard[\s\S]*user=\{sessionUser\}[\s\S]*initialData=\{initialData\}[\s\S]*initialStep=\{initialStep\}/)
})

test('setup completion is persisted before dashboard navigation', () => {
  const brokerRoute = fs.readFileSync('app/api/brokers/route.ts', 'utf8')
  const registration = fs.readFileSync('lib/broker-registration.ts', 'utf8')
  assert.match(wizard, /await response\.json\(\)/)
  assert.match(wizard, /await refreshSession\(\)/)
  assert.match(brokerRoute, /createBrokerForExistingUser\(/)
  assert.match(registration, /await tx\.brokerRegistration\.update\(/)
  assert.match(registration, /completedAt: new Date\(\)/)
})

test('status endpoint shares the same authoritative state machine', () => {
  assert.match(status, /getBrokerOnboardingStatus\(user\)/)
  assert.match(status, /import \{ getBrokerOnboardingStatus \} from '@\/lib\/broker-onboarding-state'/)
})
