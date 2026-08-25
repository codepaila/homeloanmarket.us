import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  organizationJsonLd,
  organizationId,
  websiteJsonLd,
  breadcrumbJsonLd,
  brokerLocalBusinessJsonLd,
  canonicalUrl,
} from '../lib/seo'

const read = (path: string) => fs.readFileSync(path, 'utf8')

test('Organization has a stable canonical @id and only genuine properties', () => {
  const ld = organizationJsonLd({
    name: 'HomeLoanMarket',
    description: 'Find mortgage brokers',
    url: canonicalUrl('/'),
    logo: '/logo.png',
    contactEmail: 'support@example.com',
    sameAs: ['https://facebook.com/hlm', '', 'javascript:alert(1)', null, 'not-a-url'],
  })
  assert.equal(ld['@type'], 'Organization')
  assert.equal(ld['@id'], organizationId())
  assert.equal(ld['@id'], 'https://homeloanmarket.com/#organization')
  assert.equal(ld.logo, '/logo.png')
  assert.equal(ld.email, 'support@example.com')
  // Only genuine http(s) social URLs survive; empty/javascript/non-URLs dropped.
  assert.deepEqual(ld.sameAs, ['https://facebook.com/hlm'])
})

test('WebSite links its publisher to the canonical Organization @id', () => {
  const ld = websiteJsonLd({ name: 'HomeLoanMarket', url: canonicalUrl('/'), searchTarget: '/brokers?search={search_term}' })
  assert.equal(ld['@type'], 'WebSite')
  assert.equal(ld['@id'], 'https://homeloanmarket.com/#website')
  assert.deepEqual(ld.publisher, { '@id': organizationId() })
  assert.equal(ld.potentialAction?.['@type'], 'SearchAction')
})

test('BreadcrumbList emits ordered canonical items', () => {
  const ld = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Find Brokers', path: '/brokers' },
    { name: 'Acme Mortgage', path: '/brokers/acme' },
  ])
  assert.equal(ld['@type'], 'BreadcrumbList')
  assert.equal(ld.itemListElement.length, 3)
  assert.deepEqual(ld.itemListElement[0], { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://homeloanmarket.com/' })
  assert.equal(ld.itemListElement[2].item, 'https://homeloanmarket.com/brokers/acme')
})

test('broker LocalBusiness uses the real identity image (profile/logo), not the cover', () => {
  const ld = brokerLocalBusinessJsonLd({
    name: 'Acme Mortgage', url: 'https://homeloanmarket.com/brokers/acme',
    image: '/profile.jpg', totalReviews: 0, avgRating: 0,
  })
  assert.equal(ld.image, '/profile.jpg')
  assert.equal('aggregateRating' in ld, false, 'no rating when there are no reviews')
})

test('broker rating comes only from real approved reviews — never a fake 5 or a badge', () => {
  const rated = brokerLocalBusinessJsonLd({
    name: 'Acme Mortgage', url: 'https://homeloanmarket.com/brokers/acme',
    totalReviews: 12, avgRating: 4.7,
  })
  assert.ok(rated.aggregateRating, 'aggregateRating must be present with real reviews')
  assert.equal(rated.aggregateRating?.ratingValue, 4.7)
  assert.equal(rated.aggregateRating?.reviewCount, 12)
})

test('broker geo represents only the physical office location (never a service radius)', () => {
  const ld = brokerLocalBusinessJsonLd({
    name: 'Acme Mortgage', url: 'https://homeloanmarket.com/brokers/acme',
    latitude: 32.7767, longitude: -96.797, totalReviews: 0, avgRating: 0,
  })
  assert.deepEqual(ld.geo, { '@type': 'GeoCoordinates', latitude: 32.7767, longitude: -96.797 })
  // No radius/areaServed is emitted from a coordinate pair.
  assert.equal('areaServed' in ld, false)
  assert.equal('geoRadius' in (ld.geo || {}), false)
})

test('broker entity omits internal IDs, ownership, and subscription data', () => {
  const ld = brokerLocalBusinessJsonLd({
    name: 'Acme Mortgage', url: 'https://homeloanmarket.com/brokers/acme',
    totalReviews: 0, avgRating: 0,
  })
  assert.equal('id' in ld, false)
  assert.equal('userId' in ld, false)
  assert.equal('subscription' in ld, false)
  assert.equal('mortgageExpertEnabled' in ld, false)
  assert.equal('internalNotes' in ld, false)
})

test('broker NMLS is exposed as a real license property when present', () => {
  const ld = brokerLocalBusinessJsonLd({
    name: 'Acme Mortgage', url: 'https://homeloanmarket.com/brokers/acme',
    nmls: '123456', totalReviews: 0, avgRating: 0,
  })
  assert.deepEqual(ld.additionalProperty, { '@type': 'PropertyValue', name: 'NMLS', value: '123456' })
})

test('blog author is represented as a Person, not a fabricated Organization', () => {
  const blogPage = read('app/(public)/blog/[slug]/page.tsx')
  assert.match(blogPage, /author: \{ '@type': 'Person', name: post\.author \}/)
  assert.doesNotMatch(blogPage, /author: \{ '@type': 'Organization', name: post\.author \}/)
})

test('broker detail page wires the new LocalBusiness + BreadcrumbList builders', () => {
  const detail = read('app/(public)/brokers/[slug]/page.tsx')
  assert.match(detail, /brokerLocalBusinessJsonLd/)
  assert.match(detail, /breadcrumbJsonLd/)
  // The rating source is still the real broker aggregate (never a hardcoded 5).
  assert.match(detail, /totalReviews: broker\.totalReviews/)
  assert.match(detail, /avgRating: broker\.avgRating/)
  // Identity image is the profile/logo, not the cover.
  assert.match(detail, /image: broker\.profileImage \|\| broker\.logo/)
  // Physical office coordinates, not a radius.
  assert.match(detail, /latitude: coords\.latitude, longitude: coords\.longitude/)
})

test('homepage Organization is built from site settings and adds a WebSite entity', () => {
  const home = read('app/(public)/page.tsx')
  assert.match(home, /organizationJsonLd/)
  assert.match(home, /websiteJsonLd/)
  assert.match(home, /settings\.siteName/)
  assert.match(home, /logo: settings\.siteLogo/)
  assert.match(home, /sameAs: \[/)
})

test('Mortgage Expert and FEATURED never feed a rating anywhere', () => {
  const detail = read('app/(public)/brokers/[slug]/page.tsx')
  // aggregateRating only ever comes from broker.avgRating/totalReviews.
  assert.doesNotMatch(detail, /ratingValue: isMortgageExpert/)
  assert.doesNotMatch(detail, /ratingValue: 5/)
  assert.doesNotMatch(detail, /isFeatured[\s\S]*aggregateRating/)
})
