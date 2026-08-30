import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const badge = read('components/brokers/BrokerSubscriptionBadge.tsx')
const card = read('components/brokers/BrokerGridCard.tsx')
const listing = read('app/(public)/brokers/page.tsx')
const detail = read('components/sections/broker/BrokerDetailClient.tsx')

test('premium badge renders the existing pro-mortage asset with accessible alt text', () => {
  assert.match(badge, /\/assets\/images\/pro-mortage-icon\.PNG/)
  assert.match(badge, /alt="Premium subscribed mortgage originator"/)
  assert.match(badge, /next\/image/)
})

test('broker card shows the badge only when isPremium is true', () => {
  assert.match(card, /isPremium = false/)
  assert.match(card, /\{isPremium && <div[\s\S]*<BrokerSubscriptionBadge/)
})

test('broker listing passes the active-subscription flag to the card', () => {
  assert.match(listing, /isPremium=\{broker\.isFeatured === true\}/)
})

test('broker detail shows the badge next to the name when featured', () => {
  assert.match(detail, /\{isFeaturedBroker && <BrokerSubscriptionBadge/)
})
