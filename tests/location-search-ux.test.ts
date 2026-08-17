import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

test('broker listing uses the main search as the only location selector', () => {
  const source = read('app/(public)/brokers/page.tsx')
  assert.match(source, /fetch\(`\/api\/location\/autocomplete\?input=/)
  assert.doesNotMatch(source, /Enable radius search/, 'no radius toggle is shown')
  assert.match(source, /selectedLocation\.normalizedAddress/)
  assert.doesNotMatch(source, /Search location|ZIP \/ Postal code|label="State"|label="City"/)
})

test('listing location selection preserves the existing token and coordinates', () => {
  const source = read('app/(public)/brokers/page.tsx')
  assert.match(source, /locationToken/)
  assert.match(source, /locationLatitude/)
  assert.match(source, /locationLongitude/)
  assert.match(source, /setSelectedLocation\(data\.location\)/)
})

test('homepage uses the shared location endpoints and carries resolved state to brokers', () => {
  const searchSection = read('components/sections/landing/SearchSection.tsx')
  const searchLib = read('lib/search.ts')
  assert.match(searchSection, /\/api\/location\/autocomplete/)
  assert.match(searchSection, /\/api\/location\/resolve/)
  assert.match(searchSection, /router\.push\(buildBrokerSearchUrl\(data\.location, ''\)\)/)
  assert.match(searchLib, /locationToken/)
  assert.match(searchLib, /radius: number = DEFAULT_RADIUS_MILES/)
})
