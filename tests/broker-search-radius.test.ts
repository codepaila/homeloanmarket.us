import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const listing = read('app/(public)/brokers/page.tsx')
const searchSection = read('components/sections/landing/SearchSection.tsx')
const searchLib = read('lib/search.ts')
const geo = read('lib/location/broker-geo.ts')
const api = read('app/api/brokers/route.ts')
const utils = read('utils/index.ts')

// A. Home autocomplete selection activates radius at 25 miles and navigates
test('home selection is a confirmed location that activates radius and navigates', () => {
  assert.match(searchSection, /router\.push\(buildBrokerSearchUrl\(data\.location, ''\)\)/, 'navigates to /brokers immediately')
  assert.match(searchLib, /DEFAULT_RADIUS_MILES = 25/, 'default radius is 25')
  assert.match(searchLib, /radius: number = DEFAULT_RADIUS_MILES/, 'radius defaults to 25')
  assert.match(searchLib, /params\.set\("location", location\.normalizedAddress\)/, 'location is preserved')
  assert.match(searchLib, /params\.set\("latitude"/, 'latitude is preserved')
  assert.match(searchLib, /params\.set\("longitude"/, 'longitude is preserved')
  assert.match(searchLib, /params\.set\("locationToken"/, 'server token is preserved')
})

// B. Manual text never enables radius
test('manual text typing does not enable radius', () => {
  assert.doesNotMatch(searchSection, /\/api\/location\/geocode/, 'home search must not geocode typed text')
  assert.doesNotMatch(listing, /resolveZip/, 'listing must not geocode a typed ZIP into a radius location')
  assert.match(searchLib, /if \(location\)/, 'radius only applies to a confirmed location')
  assert.match(searchLib, /else if \(text\)/, 'free text uses the text branch')
  assert.match(searchLib, /params\.set\("search", text\)/, 'free text is a plain text search')
})

// C. Listing page radius default/preservation + pagination
test('listing treats a confirmed location as radius search defaulting to 25 miles', () => {
  assert.match(listing, /parseResolvedLocation\(params\)/, 'parses confirmed location from URL')
  assert.match(listing, /DEFAULT_RADIUS_MILES/, 'defaults to 25 when radius missing')
  assert.match(listing, /setSelectedLocation\(resolvedLocation\)/, 'restores confirmed location')
})

test('listing preserves an explicit radius instead of overwriting with 25', () => {
  assert.match(listing, /radiusParam !== null && Number\.isFinite\(radiusParam\) && radiusParam >= 0 && radiusParam <= 100 \? radiusParam : DEFAULT_RADIUS_MILES/)
})

test('pagination preserves location and radius', () => {
  assert.match(listing, /page, radius, selectedLocation/, 'URL effect depends on page + radius + location')
  assert.match(listing, /onPageChange=\{setPage\}/, 'pagination only changes page')
})

test('changing the radius is committed to the URL and keeps the location', () => {
  assert.match(listing, /setOrDelete\('radius', selectedLocation \? String\(radius\) : ''\)/)
  assert.match(listing, /setOrDelete\('location', selectedLocation\?\.normalizedAddress/)
})

// D. Clearing removes location + radius state
test('clearing a location disables radius and drops stale params', () => {
  assert.match(listing, /setSelectedLocation\(null\)/)
  assert.match(listing, /setRadius\(25\)/)
  // Clearing sets the location params to empty (setOrDelete deletes them).
  assert.match(listing, /setOrDelete\('locationToken', selectedLocation\?\.token \|\| ''\)/)
  assert.match(listing, /setOrDelete\('latitude', selectedLocation \? String\(selectedLocation\.latitude\) : ''\)/)
  assert.match(listing, /setOrDelete\('longitude', selectedLocation \? String\(selectedLocation\.longitude\) : ''\)/)
})

// E. Ordering: FEATURED (active subscription) first, then admin-enabled
// Mortgage Expert brokers, then brokers with an uploaded profile image, then
// the rest — all after geographic filtering.
test('radius geo pipeline orders FEATURED brokers before FREE before pagination', () => {
  assert.match(geo, /\$sort: \{ featured: -1, featuredRank: -1, mortgageExpertEnabled: -1, profileImage: -1, experienceYears: -1, _id: 1 \}/)
  assert.ok(geo.indexOf('$sort') < geo.indexOf('$skip'), 'ordering happens before pagination')
})

test('FEATURED status in geo ordering comes from the active FEATURED subscription', () => {
  assert.match(geo, /\$lookup: \{ from: 'broker_subscriptions'/, 'geo pipeline joins the subscription collection')
  assert.match(geo, /\$eq: \['\$\$s\.plan', 'FEATURED'\]/, 'featured requires the FEATURED plan')
  assert.match(geo, /\$eq: \['\$\$s\.isActive', true\]/, 'featured requires an active subscription')
  assert.match(geo, /\$gt: \['\$\$s\.endDate', now\]/, 'featured respects the endDate')
  assert.match(geo, /featured: -1, featuredRank: -1, mortgageExpertEnabled: -1/, 'featured subscription sorts before featuredRank')
})

test('radius geo ordering never ranks by rating or reviews', () => {
  assert.doesNotMatch(geo, /avgRating: -1/)
  assert.doesNotMatch(geo, /totalReviews: -1/)
})

test('non-geo listing orders by featuredRank descending', () => {
  assert.match(api, /featuredRank: 'desc'/)
})

// F. Exactly 20 brokers per page
test('broker listing page size is exactly 20', () => {
  assert.match(utils, /export const PAGE_SIZE = 20/)
  assert.match(utils, /export const TABLE_ROW_PAGE = 20/)
  assert.match(api, /const take = TABLE_ROW_PAGE/)
})

// G. Outside click closes dropdown; suggestion selection works
test('outside click closes the listing autocomplete without breaking selection', () => {
  assert.match(listing, /addEventListener\('pointerdown'/)
  assert.match(listing, /searchRef\.current\.contains/)
  assert.match(listing, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/)
})

// Confirmed-location parsing requires coordinates
test('parseResolvedLocation requires coordinates to treat a URL as a confirmed location', () => {
  assert.match(searchLib, /if \(!Number\.isFinite\(latitude\) \|\| !Number\.isFinite\(longitude\)\) return null/)
})
