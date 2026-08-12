import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const dashboard = fs.readFileSync('app/broker/dashboard/page.tsx', 'utf8')
const setup = fs.readFileSync('app/setup/page.tsx', 'utf8')
const status = fs.readFileSync('app/api/broker-registration/status/route.ts', 'utf8')
const wizard = fs.readFileSync('components/sections/broker/BrokerSetupWizard.tsx', 'utf8')
const state = fs.readFileSync('lib/broker-onboarding-state.ts', 'utf8')

test('dashboard sends incomplete broker registrations to plan before setup', () => {
  assert.match(dashboard, /registrationSubscription\.status !== 'ACTIVE'/)
  assert.match(dashboard, /redirect\('\/broker\/subscription\/select'\)/)
  assert.match(dashboard, /redirect\('\/setup'\)/)
})

test('setup and dashboard share Broker existence as completion state', () => {
  assert.match(dashboard, /isBrokerSetupComplete\(user\)/)
  assert.match(status, /isBrokerSetupComplete\(user\)/)
  assert.match(state, /Boolean\(user\.brokerProfile\)/)
  assert.doesNotMatch(setup, /session\.user\?\.role === 'BROKER' && session\.user\.brokerProfile/)
  assert.match(setup, /status === 'unauthenticated'/)
  assert.match(wizard, /await refreshSession\(\)/)
  assert.match(wizard, /router\.push\('\/broker\/dashboard'\)/)
  assert.doesNotMatch(wizard, /router\.refresh\(\)/)
})

test('setup completion is persisted before dashboard navigation', () => {
  const brokerRoute = fs.readFileSync('app/api/brokers/route.ts', 'utf8')
  const registration = fs.readFileSync('lib/broker-registration.ts', 'utf8')
  assert.match(wizard, /await response\.json\(\)/)
  assert.match(brokerRoute, /createBrokerForExistingUser\(/)
  assert.match(registration, /await tx\.brokerRegistration\.update\(/)
  assert.match(registration, /completedAt: new Date\(\)/)
})
