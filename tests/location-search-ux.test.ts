import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

test('broker listing uses the main search as the only location selector', () => {
  const source = read('app/(public)/brokers/page.tsx')
  assert.match(source, /fetch\(`\/api\/location\/autocomplete\?input=/)
  assert.match(source, /Enable radius search/)
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

test('homepage uses the same location endpoints and carries resolved state to brokers', () => {
  const source = read('components/sections/landing/Hero.tsx')
  assert.match(source, /\/api\/location\/autocomplete/)
  assert.match(source, /\/api\/location\/resolve/)
  assert.match(source, /\/api\/location\/geocode/)
  assert.match(source, /locationToken/)
  assert.match(source, /router\.push\(queryString \? `\/brokers\?\$\{queryString\}`/)
})
