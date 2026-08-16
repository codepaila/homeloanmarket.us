import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const brokersPage = read('app/(public)/brokers/page.tsx')
const searchSection = read('components/sections/landing/SearchSection.tsx')
const hero = read('components/sections/landing/Hero2.tsx')

test('broker listing defaults to a 25-mile radius', () => {
  assert.match(brokersPage, /useState\(25\)/)
})

test('radius toggle/checkbox has been removed', () => {
  assert.doesNotMatch(brokersPage, /radiusEnabled/)
  assert.doesNotMatch(brokersPage, /Enable radius search/)
})

test('hydration defaults to 25 miles when no radius param and preserves explicit radius', () => {
  assert.match(brokersPage, /const radiusParamStr = params\.get\('radius'\)/)
  assert.match(brokersPage, /: 25/)
})

test('URL stores the radius only when a location is selected', () => {
  assert.match(brokersPage, /setOrDelete\('radius', selectedLocation \? String\(radius\) : ''\)/)
})

test('home search navigates with the default 25-mile radius', () => {
  assert.match(searchSection, /params\.set\('radius', '25'\)/)
  assert.match(hero, /params\.set\('radius', '25'\)/)
})
