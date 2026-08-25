import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  isValidUsZip,
  isValidGeoJsonPoint,
  requireValidResolvedUSLocation,
  InvalidUSLocationError,
  toBrokerLocationPatch,
} from '../lib/location/broker-location'

const read = (p: string) => fs.readFileSync(p, 'utf8')

// ---------------------------------------------------------------------------
// US location validation helpers
// ---------------------------------------------------------------------------

test('US ZIP validation accepts 5-digit and ZIP+4, rejects everything else', () => {
  assert.equal(isValidUsZip('78701'), true)
  assert.equal(isValidUsZip('78701-1234'), true)
  assert.equal(isValidUsZip('  78701  '), true)
  assert.equal(isValidUsZip('7870'), false)
  assert.equal(isValidUsZip('787011'), false)
  assert.equal(isValidUsZip('ABCDE'), false)
  assert.equal(isValidUsZip('110001'), false, '6-digit Indian PIN-style values must be rejected')
  assert.equal(isValidUsZip(null), false)
  assert.equal(isValidUsZip(undefined), false)
})

test('isValidGeoJsonPoint requires a Point with [longitude, latitude]', () => {
  assert.equal(isValidGeoJsonPoint({ type: 'Point', coordinates: [-97.7431, 30.2672] }), true)
  assert.equal(isValidGeoJsonPoint({ type: 'Point', coordinates: [-97.7431] }), false)
  assert.equal(isValidGeoJsonPoint({ type: 'Point', coordinates: [-97.7431, 30.2672, 0] }), false)
  assert.equal(isValidGeoJsonPoint({ type: 'LineString', coordinates: [-97.7431, 30.2672] }), false)
  assert.equal(isValidGeoJsonPoint({ coordinates: [-97.7431, 30.2672] }), false)
  assert.equal(isValidGeoJsonPoint(null), false)
  assert.equal(isValidGeoJsonPoint({ type: 'Point', coordinates: [30.2672, -97.7431] }), false, 'a reversed Austin pair puts latitude out of range and is rejected')
})

test('requireValidResolvedUSLocation enforces country, city, state, ZIP, and coordinates', () => {
  const valid = { countryCode: 'US' as const, city: 'Austin', state: 'TX', zip: '78701', latitude: 30.2672, longitude: -97.7431 }
  assert.doesNotThrow(() => requireValidResolvedUSLocation(valid))

  assert.throws(() => requireValidResolvedUSLocation({ ...valid, countryCode: 'IN' } as never), InvalidUSLocationError)
  assert.throws(() => requireValidResolvedUSLocation({ ...valid, countryCode: 'CA' } as never), InvalidUSLocationError)
  assert.throws(() => requireValidResolvedUSLocation({ ...valid, city: '' }), InvalidUSLocationError)
  assert.throws(() => requireValidResolvedUSLocation({ ...valid, state: 'MH' }), InvalidUSLocationError, 'non-US state code rejected')
  assert.throws(() => requireValidResolvedUSLocation({ ...valid, state: '' }), InvalidUSLocationError)
  assert.throws(() => requireValidResolvedUSLocation({ ...valid, zip: '110001' }), InvalidUSLocationError)
  assert.throws(() => requireValidResolvedUSLocation({ ...valid, zip: '' }), InvalidUSLocationError)
  assert.throws(() => requireValidResolvedUSLocation({ ...valid, latitude: 999 }), InvalidUSLocationError)
})

test('toBrokerLocationPatch persists GeoJSON as [longitude, latitude]', () => {
  const patch = toBrokerLocationPatch({
    placeId: 'ChIJ-test', normalizedAddress: '123 Main St, Austin, TX 78701, USA',
    city: 'Austin', state: 'TX', zip: '78701', countryCode: 'US',
    latitude: 30.2672, longitude: -97.7431,
  })
  assert.deepEqual(patch?.location, { type: 'Point', coordinates: [-97.7431, 30.2672] })
  assert.equal(patch?.googlePlaceId, 'ChIJ-test')
  assert.equal(patch?.locationCountryCode, 'US')
})

// ---------------------------------------------------------------------------
// Onboarding draft persistence
// ---------------------------------------------------------------------------

test('draft PATCH persists the full US office + licensing + media payload', () => {
  const draft = read('app/api/broker-registration/onboarding/route.ts')
  for (const field of ['pinCode', 'googlePlaceId', 'locationCountryCode', 'profileImage', 'coverImage', 'nmls', 'licenseStates', 'location']) {
    assert.match(draft, new RegExp(`'${field}'`), `draft must persist ${field}`)
  }
  assert.match(draft, /zipCode/, 'legacy zipCode input must still be accepted')
  assert.match(draft, /delete data\.zipCode/, 'zipCode must be normalized into pinCode')
  assert.match(draft, /data\.pinCode = data\.zipCode/)
  assert.match(draft, /isSameOriginRequest\(request\)/)
})

test('draft API derives ownership from the authenticated session, never client IDs', () => {
  const draft = read('app/api/broker-registration/onboarding/route.ts')
  assert.match(draft, /getCurrentUser\(\)/)
  assert.match(draft, /user\.brokerRegistration\.id/)
  assert.doesNotMatch(draft, /body\.userId|body\.brokerId|body\.registrationId/, 'client-supplied ownership IDs must never be used')
})

// ---------------------------------------------------------------------------
// Completion: server-authoritative office location
// ---------------------------------------------------------------------------

test('completion re-resolves the Google place and derives canonical fields server-side', () => {
  const route = read('app/api/brokers/route.ts')
  assert.match(route, /resolveUSPlace\(placeId\)/)
  assert.match(route, /requireValidResolvedUSLocation\(resolvedLocation\)/)
  assert.match(route, /A validated US office location is required/)
  assert.match(route, /body\.location as \{ placeId/, 'place ID is read from the selected location object')
  assert.doesNotMatch(route, /officeAddress: body\.officeAddress/, 'client officeAddress text must never be trusted directly')
  assert.doesNotMatch(route, /city: body\.city/, 'client city text must never be trusted directly')
  assert.doesNotMatch(route, /state: body\.state/, 'client state text must never be trusted directly')
})

test('completion uses the shared NMLS helper and passes media to persistence', () => {
  const route = read('app/api/brokers/route.ts')
  assert.match(route, /normalizeNmls\(body\.nmls\)/)
  assert.match(route, /nmlsValidationError\(nmls\)/)
  assert.match(route, /profileImage: typeof body\.profileImage/)
  assert.match(route, /coverImage: typeof body\.coverImage/)
  assert.match(route, /logo: typeof body\.logo/)
  assert.match(route, /isSameOriginRequest\(request\)/)
})

test('broker persistence derives address from the resolved location and saves media', () => {
  const lib = read('lib/broker-registration.ts')
  assert.match(lib, /const officeAddress = data\.location\?\.normalizedAddress/)
  assert.match(lib, /const pinCode = data\.location\?\.zip/)
  assert.match(lib, /logo: data\.logo \|\| null/)
  assert.match(lib, /profileImage: data\.profileImage \|\| null/)
  assert.match(lib, /coverImage: data\.coverImage \|\| null/)
  assert.match(lib, /coordinates: \[data\.location\.longitude, data\.location\.latitude\]/)
})

// ---------------------------------------------------------------------------
// Profile edit: location consistency
// ---------------------------------------------------------------------------

test('profile edit resolves a new place or clears stale geo when the address changes', () => {
  const me = read('app/api/brokers/me/route.ts')
  assert.match(me, /resolveUSPlace\(placeId\)/)
  assert.match(me, /requireValidResolvedUSLocation\(resolved\)/)
  assert.match(me, /updateData\.googlePlaceId = null/, 'editing the address without a place clears stale place ID')
  assert.match(me, /updateData\.location = Prisma\.DbNull/, 'editing the address without a place clears stale coordinates')
  assert.match(me, /else if \(body\.zipCode !== undefined\)/, 'legacy zipCode alias is accepted')
  assert.match(me, /isSameOriginRequest\(request\)/)
})

test('profile edit form restores pinCode and uses the shared location picker', () => {
  const edit = read('components/sections/broker/EditProfile.tsx')
  assert.match(edit, /pinCode: broker\?\.pinCode/, 'ZIP must restore from pinCode, not the nonexistent zipCode field')
  assert.match(edit, /USLocationPicker/)
  assert.match(edit, /form\.setValue\('location', undefined\)/, 'manual address edits must clear the place selection')
  assert.doesNotMatch(edit, /name="zipCode"/, 'the form field must use pinCode')
  assert.doesNotMatch(edit, /zipCode: broker\?\.zipCode/)
  assert.equal((edit.match(/CoverImageUpload/g) || []).length >= 1, true)
  assert.doesNotMatch(edit, /ImageUpload[\s\S]*?type="cover"/, 'no duplicate generic cover upload path')
})

// ---------------------------------------------------------------------------
// Media: direct broker upload, no Admin Media Picker
// ---------------------------------------------------------------------------

test('generic broker upload supports profile and cover from device only', () => {
  const upload = read('app/api/upload/image/route.ts')
  assert.match(upload, /profile: \{ category: "brokers\/profile"/)
  assert.match(upload, /cover: \{ category: "brokers\/cover"/)
  assert.match(upload, /BROKER_ONLY_TYPES/)
  assert.doesNotMatch(upload, /MediaPicker|mediaSelectUrl/)
})

test('wizard uploads profile/cover from the device and never renders the Admin Media Picker', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.match(wizard, /type="profile"/)
  assert.match(wizard, /type="cover"/)
  assert.doesNotMatch(wizard, /MediaPickerDialog|mediaSelectUrl|MediaFolder|useMediaAssets/)
  assert.match(wizard, /name="profileImage"/)
  assert.match(wizard, /name="coverImage"/)
})

// ---------------------------------------------------------------------------
// Wizard: required validated place + mismatch guard
// ---------------------------------------------------------------------------

test('wizard requires a Google-resolved place and clears it when address text is edited', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.match(wizard, /Select a validated US office location from the suggestions/)
  assert.match(wizard, /Boolean\(value\.placeId\)/)
  assert.match(wizard, /form\.setValue\('location', undefined\)/, 'manual address edits clear the place selection')
  assert.match(wizard, /'pinCode', 'location'/, 'step validation covers the place selection')
  assert.match(wizard, /restoreInitialData\(initialData\)/)
})

test('location picker offers a clear action and strips the search token', () => {
  const picker = read('components/location/USLocationPicker.tsx')
  assert.match(picker, /Clear location/)
  assert.match(picker, /Search for your business or office address/)
  assert.match(picker, /delete rest\.token/, 'the search token is stripped before persistence')
  assert.doesNotMatch(picker, /MediaPicker/)
})

// ---------------------------------------------------------------------------
// Security: no client-supplied ownership
// ---------------------------------------------------------------------------

test('completion and profile-edit APIs never trust client ownership IDs', () => {
  const route = read('app/api/brokers/route.ts')
  assert.doesNotMatch(route, /body\.userId|body\.brokerId|body\.registrationId/)
  const me = read('app/api/brokers/me/route.ts')
  assert.match(me, /where: \{ userId: currentUser\.id \}/, 'broker is derived from the authenticated user')
  assert.doesNotMatch(me, /body\.brokerId|body\.userId/)
})