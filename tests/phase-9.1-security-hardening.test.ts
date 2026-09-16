import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const couponRoute = read('app/api/company/subscription/coupon/validate/route.ts')
const couponLib = read('lib/company-coupon.ts')
const checkout = read('app/api/company/subscription/checkout/route.ts')
const rateLimit = read('lib/rateLimit.ts')
const autocomplete = read('app/api/location/autocomplete/route.ts')
const geocode = read('app/api/location/geocode/route.ts')
const resolve = read('app/api/location/resolve/route.ts')
const brokerDetail = read('app/api/brokers/[id]/route.ts')
const companyDetail = read('app/api/company/[slug]/route.ts')
const profileView = read('lib/profile-view.ts')
const publicBroker = read('lib/public-broker.ts')
const brokerRegister = read('app/api/auth/register/broker/route.ts')
const signupPage = read('app/(public)/auth/signup/page.tsx')

// ===========================================================================
// C1 — Company advertising coupon validation
// ===========================================================================

test('C1: coupon validation requires an authenticated Company context before Stripe', () => {
  assert.match(couponRoute, /isSameOriginRequest/)
  assert.match(couponRoute, /getCurrentCompany\(\)/)
  assert.match(couponRoute, /Company access required/)
  const authIndex = couponRoute.indexOf('getCurrentCompany()')
  const stripeIndex = couponRoute.indexOf('validateCompanyCoupon(code)')
  assert.ok(authIndex > -1 && stripeIndex > authIndex, 'company auth runs before the Stripe lookup')
})

test('C1: coupon validation is distributed-rate-limited before Stripe', () => {
  assert.match(couponRoute, /companyCouponValidateRateLimit/)
  const limitIndex = couponRoute.indexOf('companyCouponValidateRateLimit.limit')
  const stripeIndex = couponRoute.indexOf('validateCompanyCoupon(code)')
  assert.ok(limitIndex > -1 && stripeIndex > limitIndex, 'limiter executes before the Stripe lookup')
  assert.match(rateLimit, /companyCouponValidateRateLimit/)
  assert.match(rateLimit, /ratelimit:company-coupon-validate/)
})

test('C1: coupon response stays display-safe (no Stripe IDs) and keeps generic semantics', () => {
  assert.match(couponRoute, /percentOff/)
  assert.match(couponRoute, /amountOff/)
  assert.doesNotMatch(couponRoute, /promotionCodeId/)
  assert.doesNotMatch(couponRoute, /stripeCustomerId|stripeSubId|coupon_id|promo_/)
})

test('C1: coupon validation does not mutate billing state and remains broker-isolated', () => {
  assert.doesNotMatch(couponRoute, /companySubscription\.(update|upsert|create)|checkout\.sessions\.create|subscriptions\.create/)
  assert.doesNotMatch(couponLib, /brokerSubscription|BrokerSubscriptionPlan/)
  // Checkout still revalidates the coupon server-side.
  assert.match(checkout, /validateCompanyCoupon/)
})

// ===========================================================================
// G1 — Google location API protection
// ===========================================================================

test('G1: all location endpoints are rate-limited before the Google call', () => {
  for (const [name, src] of [['autocomplete', autocomplete], ['geocode', geocode], ['resolve', resolve]] as const) {
    assert.match(src, /locationLookupExceeded/, `${name} uses the shared location limiter`)
  }
  assert.match(rateLimit, /locationApiRateLimit/)
  assert.match(rateLimit, /export async function locationLookupExceeded/)
})

test('G1: location inputs are bounded before the Google call', () => {
  assert.match(autocomplete, /MAX_AUTOCOMPLETE_INPUT/)
  assert.match(geocode, /MAX_ADDRESS_LENGTH/)
  assert.match(resolve, /MAX_PLACE_ID_LENGTH/)
  // Provider calls remain and occur after the guards.
  assert.ok(autocomplete.indexOf('locationLookupExceeded') < autocomplete.indexOf('autocompleteUSPlaces(input)'))
  assert.ok(geocode.indexOf('locationLookupExceeded') < geocode.indexOf('geocodeUSAddress(body.address)'))
  assert.ok(resolve.indexOf('locationLookupExceeded') < resolve.indexOf('resolveUSPlace(body.placeId)'))
})

test('G1: POST location endpoints carry a defense-in-depth origin check', () => {
  assert.match(geocode, /isSameOriginRequest/)
  assert.match(resolve, /isSameOriginRequest/)
})

test('G1: provider credentials are never returned in a response', () => {
  assert.doesNotMatch(autocomplete, /apiKey|API_KEY|X-Goog-Api-Key/)
  assert.doesNotMatch(geocode, /apiKey|GOOGLE_MAPS_SERVER/)
  assert.doesNotMatch(resolve, /apiKey|GOOGLE_MAPS_SERVER/)
})

// ===========================================================================
// P1 — Public profile-view write protection
// ===========================================================================

test('P1: public profile routes record views through the dedup helper, not raw increments', () => {
  for (const [name, src] of [['brokers/[id]', brokerDetail], ['company/[slug]', companyDetail]] as const) {
    assert.match(src, /recordProfileView/, `${name} uses the dedup helper`)
    assert.doesNotMatch(src, /profileViews:\s*\{\s*increment:\s*1\s*\}/, `${name} has no unbounded inline increment`)
  }
  assert.match(profileView, /profileViewDedup/)
  assert.match(profileView, /increment: 1/)
})

test('P1: profile-view recording is non-critical and never throws to the caller', () => {
  assert.match(profileView, /try\s*\{/)
  assert.match(profileView, /catch/)
  assert.match(rateLimit, /profileViewDedup/)
  assert.match(rateLimit, /Ratelimit\.fixedWindow\(1, "1 h"\)/)
})

test('P1: profile-view reviews reads are bounded', () => {
  assert.match(brokerDetail, /take: 12/)
  assert.match(companyDetail, /take: 12/)
})

test('P1: the public DTO still excludes internal profileViews', () => {
  assert.doesNotMatch(publicBroker, /profileViews/)
})

// ===========================================================================
// K1 — Broker registration abuse controls
// ===========================================================================

test('K1: broker registration enforces distributed IP and email limiters', () => {
  assert.match(brokerRegister, /brokerRegisterRateLimit/)
  assert.match(brokerRegister, /brokerRegisterEmailRateLimit/)
  assert.match(rateLimit, /brokerRegisterEmailRateLimit/)
})

test('K1: broker registration adds a defense-in-depth origin check', () => {
  assert.match(brokerRegister, /isSameOriginRequest/)
})

test('K1: the client CAPTCHA is no longer treated as a server security boundary', () => {
  assert.doesNotMatch(brokerRegister, /expectedCaptcha/)
  assert.doesNotMatch(brokerRegister, /captchaAnswer/)
  // The client UX CAPTCHA is still present.
  assert.match(signupPage, /expectedCaptcha:\s*captcha\.answer/)
})
