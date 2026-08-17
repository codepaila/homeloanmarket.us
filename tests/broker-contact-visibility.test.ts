import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const api = read('app/api/company/[slug]/route.ts')
const page = read('app/(public)/brokers/[slug]/page.tsx')
const client = read('components/sections/broker/BrokerDetailClient.tsx')

test('public profile API returns contact for every eligible broker', () => {
  assert.match(api, /toPublicBrokerRecord\(broker, \{ includeContact: true \}\)/)
  assert.match(api, /canShowContact: true/)
  assert.doesNotMatch(api, /canShowContact = hasPaidEntitlement/)
  assert.doesNotMatch(api, /canShowContact \|\| isOwner/)
})

test('public profile API keeps subscription scoped to FEATURED presentation only', () => {
  assert.match(api, /hasPaidEntitlement\(broker\.subscription\)/)
  assert.match(api, /isFeatured = true/)
  assert.doesNotMatch(api, /let canShowContact = false/)
})

test('server profile page hydrates initial broker data with contact fields', () => {
  assert.match(page, /toPublicBrokerRecord\(broker, \{ includeContact: true \}\)/)
})

test('profile client renders phone and email for all brokers, not gated by subscription', () => {
  assert.match(client, /href=\{`tel:\$\{phone\}`\}/)
  assert.match(client, /href=\{`mailto:\$\{email\}`\}/)
  assert.doesNotMatch(client, /phone && canShowContact/)
  assert.doesNotMatch(client, /email && canShowContact/)
  assert.doesNotMatch(client, /available to subscribed brokers only/)
})

test('profile client never relies on the logged-in user email for the broker public email', () => {
  assert.doesNotMatch(client, /user\?\.email/)
  assert.doesNotMatch(client, /getBrokerContactEmail/)
})
