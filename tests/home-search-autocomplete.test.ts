import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const searchSection = read('components/sections/landing/SearchSection.tsx')
const hero = read('components/sections/landing/Hero2.tsx')

test('home search inputs use the "Search by city or ZIP code" placeholder', () => {
  assert.match(searchSection, /placeholder="Search by city or ZIP code"/)
  assert.match(hero, /placeholder="Search by city or ZIP code"/)
  assert.doesNotMatch(hero, /Search by broker, company/)
})

test('home search submits the canonical `search` parameter, not `q`', () => {
  assert.match(searchSection, /params\.set\('search', text\)/)
  assert.match(hero, /params\.set\('search', text\)/)
  assert.doesNotMatch(searchSection, /params\.set\('q', text\)/)
  assert.doesNotMatch(hero, /params\.set\('q', text\)/)
})

test('home search geocodes a 5-digit ZIP into location parameters', () => {
  assert.match(searchSection, /\/api\/location\/geocode/)
  assert.match(searchSection, /locationToken/)
  assert.match(hero, /\/api\/location\/geocode/)
})

test('home search maps the state control to the supported state parameter', () => {
  assert.match(hero, /params\.set\('state', state\)/)
})

test('autocomplete supports keyboard navigation', () => {
  assert.match(searchSection, /ArrowDown/)
  assert.match(searchSection, /ArrowUp/)
  assert.match(searchSection, /'Enter'/)
  assert.match(searchSection, /'Escape'/)
})

test('autocomplete shows loading and empty states', () => {
  assert.match(searchSection, /Searching brokers…/)
  assert.match(searchSection, /No brokers found/)
})

test('autocomplete guards against stale responses with AbortController and a request id', () => {
  assert.match(searchSection, /AbortController/)
  assert.match(searchSection, /requestRef/)
})

test('clicking a location suggestion navigates to the broker listing for that location', () => {
  assert.match(searchSection, /router\.push\(buildBrokerSearchUrl\(data\.location, ''\)\)/)
  assert.match(searchSection, /locationToken/)
})
