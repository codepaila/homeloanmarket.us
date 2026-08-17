import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const searchSection = read('components/sections/landing/SearchSection.tsx')
const searchLib = read('lib/search.ts')
const hero = read('components/sections/landing/Hero2.tsx')

test('home search inputs use the "Search by city or ZIP code" placeholder', () => {
  assert.match(searchSection, /placeholder="Search by city or ZIP code"/)
  assert.match(hero, /placeholder="Search by city or ZIP code"/)
  assert.doesNotMatch(hero, /Search by broker, company/)
})

test('home search builds the canonical `search` parameter (not `q`) for free text', () => {
  assert.match(searchLib, /params\.set\("search", text\)/)
  assert.doesNotMatch(searchLib, /params\.set\("q", text\)/)
  assert.match(hero, /params\.set\('search', text\)/)
  assert.doesNotMatch(hero, /params\.set\('q', text\)/)
})

test('manual free text never enables radius search', () => {
  // Typing a city or ZIP must produce a plain text search, not a radius search.
  assert.doesNotMatch(searchSection, /\/api\/location\/geocode/, 'home search must not geocode free text')
  assert.match(searchLib, /if \(location\)/, 'radius only applies to a confirmed location')
  assert.match(searchLib, /else if \(text\)/, 'free text falls into the plain text branch')
  assert.match(searchLib, /params\.set\("search", text\)/, 'free text is submitted as search only')
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

test('clicking a location suggestion activates radius at 25 miles and navigates', () => {
  assert.match(searchSection, /router\.push\(buildBrokerSearchUrl\(data\.location, ''\)\)/)
  assert.match(searchLib, /params\.set\("location", location\.normalizedAddress\)/)
  assert.match(searchLib, /params\.set\("radius", String\(radius\)\)/)
  assert.match(searchLib, /DEFAULT_RADIUS_MILES = 25/)
  assert.match(searchLib, /radius: number = DEFAULT_RADIUS_MILES/)
})

test('a confirmed location includes coordinates and a server token in the URL', () => {
  assert.match(searchLib, /params\.set\("latitude", String\(location\.latitude\)\)/)
  assert.match(searchLib, /params\.set\("longitude", String\(location\.longitude\)\)/)
  assert.match(searchLib, /locationToken/)
})

test('autocomplete closes when clicking outside the search component', () => {
  assert.match(searchSection, /addEventListener\('pointerdown'/)
  assert.match(searchSection, /searchRef\.current\.contains\(e\.target as Node\)/)
  assert.match(searchSection, /removeEventListener\('pointerdown'/)
})
