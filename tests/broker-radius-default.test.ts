import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const brokersPage = read('app/(public)/brokers/page.tsx')
const searchSection = read('components/sections/landing/SearchSection.tsx')
const searchLib = read('lib/search.ts')

test('broker listing defaults to a 25-mile radius', () => {
  assert.match(brokersPage, /useState\(25\)/)
})

test('radius toggle/checkbox has been removed', () => {
  assert.doesNotMatch(brokersPage, /radiusEnabled/)
  assert.doesNotMatch(brokersPage, /Enable radius search/)
})

test('hydration defaults to 25 miles when no radius param and preserves explicit radius', () => {
  assert.match(brokersPage, /const radiusParamStr = params\.get\('radius'\)/)
  assert.match(brokersPage, /DEFAULT_RADIUS_MILES/)
})

test('URL stores the radius only when a location is selected', () => {
  assert.match(brokersPage, /setOrDelete\('radius', selectedLocation \? String\(radius\) : ''\)/)
})

test('a Google location selection resets radius to the default 25 miles', () => {
  assert.match(brokersPage, /setRadius\(DEFAULT_RADIUS_MILES\)/)
})

test('shared search helper defaults radius to 25 miles for confirmed locations', () => {
  assert.match(searchLib, /DEFAULT_RADIUS_MILES = 25/)
  assert.match(searchLib, /radius: number = DEFAULT_RADIUS_MILES/)
})

test('home search navigates with the default 25-mile radius for a confirmed location', () => {
  assert.match(searchSection, /buildBrokerSearchUrl/)
  assert.match(searchLib, /params\.set\("radius", String\(radius\)\)/)
})
