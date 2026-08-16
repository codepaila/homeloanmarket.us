import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const page = read('app/(public)/brokers/[slug]/page.tsx')
const api = read('app/api/company/[slug]/route.ts')
const detail = read('components/sections/broker/BrokerDetailClient.tsx')

test('public detail page exposes ownership as a boolean, not the raw userId', () => {
  assert.match(page, /hasOwner: Boolean\(broker\.userId\)/)
  assert.doesNotMatch(page, /publicBroker = \{ \.\.\.toPublicBrokerRecord\(broker\), userId:/)
})

test('broker detail API exposes hasOwner derived from ownership', () => {
  assert.match(api, /hasOwner: Boolean\(broker\.userId\)/)
})

test('description is hidden for unowned brokers', () => {
  assert.match(detail, /const showDescription = hasOwner !== false/)
  assert.match(detail, /showDescription=\{showDescription\}/)
})

test('AboutSection conditionally renders the description heading and text', () => {
  assert.match(detail, /\{showDescription && \(/)
  assert.match(detail, /showDescription = true/)
})
