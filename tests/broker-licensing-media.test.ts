import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { US_STATES, US_STATE_CODES, isUsStateCode, usStateName } from '../lib/us-states'
import {
  normalizeNmls,
  isValidNmls,
  nmlsValidationError,
  normalizeLicenseStates,
  validateLicenseStates,
  requireValidLicenseStates,
} from '../lib/broker-licensing'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const exists = (path: string) => fs.existsSync(path)

// ---------------------------------------------------------------------------
// US states
// ---------------------------------------------------------------------------

test('US_STATES contains 50 states + DC with stable two-letter codes', () => {
  assert.equal(US_STATES.length, 51)
  assert.ok(US_STATE_CODES.has('AL'))
  assert.ok(US_STATE_CODES.has('CA'))
  assert.ok(US_STATE_CODES.has('TX'))
  assert.ok(US_STATE_CODES.has('WY'))
  assert.equal(usStateName('CA'), 'California')
  assert.equal(isUsStateCode('ca'), true)
  assert.equal(isUsStateCode('XX'), false)
  // All states are legitimate US states — none are Indian states/cities. Note
  // "Indiana" is a US state and legitimately contains the substring "India".
  assert.equal(US_STATES.every((s) => isUsStateCode(s.code)), true)
  const joined = US_STATES.map((s) => s.name).join(' ')
  for (const nonUs of ['Maharashtra', 'Delhi', 'Punjab', 'Karnataka', 'Kerala', 'Tamil Nadu', 'Mumbai', 'Kolkata', 'Chennai', 'Gujarat']) {
    assert.doesNotMatch(joined, new RegExp(nonUs, 'i'), `${nonUs} is not a US state`)
  }
})

// ---------------------------------------------------------------------------
// NMLS validation
// ---------------------------------------------------------------------------

test('normalizeNmls trims whitespace', () => {
  assert.equal(normalizeNmls('  12345678  '), '12345678')
  assert.equal(normalizeNmls(undefined), '')
  assert.equal(normalizeNmls(null), '')
})

test('valid NMLS accepted; missing/empty/invalid rejected', () => {
  assert.equal(isValidNmls('12345678'), true)
  assert.equal(isValidNmls('1234'), true)
  assert.equal(isValidNmls('1234567890'), true)
  assert.equal(isValidNmls(''), false)
  assert.equal(isValidNmls('123'), false)
  assert.equal(isValidNmls('12345678901'), false)
  assert.equal(isValidNmls('ABCDEFGH'), false)
  assert.equal(nmlsValidationError(''), 'NMLS ID is required')
  assert.equal(nmlsValidationError('123'), 'NMLS ID must be 4–10 digits')
  assert.equal(nmlsValidationError('12345678'), null)
})

// ---------------------------------------------------------------------------
// License states
// ---------------------------------------------------------------------------

test('normalizeLicenseStates dedupes, uppercases, and keeps strings (validation is separate)', () => {
  assert.deepEqual(normalizeLicenseStates(['ca', 'TX', 'CA']), ['CA', 'TX'])
  // Non-string entries are dropped; invalid codes are kept for validateLicenseStates to reject.
  assert.deepEqual(normalizeLicenseStates(['XX', 'FL', 42]), ['XX', 'FL'])
  assert.deepEqual(normalizeLicenseStates('TX'), [])
  assert.deepEqual(normalizeLicenseStates(undefined), [])
})

test('validateLicenseStates requires at least one valid US state', () => {
  assert.deepEqual(validateLicenseStates([]), { ok: false, error: 'Select at least one licensed state' })
  assert.deepEqual(validateLicenseStates('CA'), { ok: false, error: 'Select at least one licensed state' })
  const one = validateLicenseStates(['CA'])
  assert.equal(one.ok, true)
  if (one.ok) assert.deepEqual(one.states, ['CA'])
  const many = validateLicenseStates(['CA', 'TX', 'FL'])
  assert.equal(many.ok, true)
  const invalid = validateLicenseStates(['CA', 'XX'])
  assert.equal(invalid.ok, false)
  if (!invalid.ok) assert.match(invalid.error, /XX/)
  assert.deepEqual(requireValidLicenseStates(['NY', 'NY']), ['NY'])
})

// ---------------------------------------------------------------------------
// Onboarding completion requires NMLS + license states (server-authoritative)
// ---------------------------------------------------------------------------

test('/api/brokers POST enforces NMLS and license states before creating a broker', () => {
  const route = read('app/api/brokers/route.ts')
  assert.match(route, /nmlsValidationError\(nmls\)/)
  assert.match(route, /validateLicenseStates\(body\.licenseStates\)/)
  assert.match(route, /licenseStates: licenseStatesResult\.states/)
  assert.match(route, /nmls,/)
})

test('createBrokerForExistingUser persists nmls + licenseStates on the Broker record', () => {
  const lib = read('lib/broker-registration.ts')
  // The canonical finalization (finalizeBrokerRegistration) reads the merged
  // onboarding data and persists the validated NMLS and license states.
  assert.match(lib, /const nmls = typeof merged\.nmls === 'string' \? merged\.nmls\.trim\(\) : ''/)
  assert.match(lib, /const licenseStates = Array\.isArray\(merged\.licenseStates\)/)
  assert.match(lib, /nmls,/)
  assert.match(lib, /licenseStates,/)
  assert.match(lib, /nmls\?: string/)
  assert.match(lib, /licenseStates\?: string\[\]/)
})

test('onboarding draft PATCH persists nmls + licenseStates and normalizes them', () => {
  const draft = read('app/api/broker-registration/onboarding/route.ts')
  assert.match(draft, /'nmls', 'licenseStates'/)
  assert.match(draft, /normalizeLicenseStates\(data\.licenseStates\)/)
})

// ---------------------------------------------------------------------------
// Broker profile edit (self-service) + editable-field allowlist
// ---------------------------------------------------------------------------

test('/api/brokers/me PATCH validates and persists nmls + licenseStates', () => {
  const me = read('app/api/brokers/me/route.ts')
  assert.match(me, /body\.nmls !== undefined/)
  assert.match(me, /nmlsValidationError\(nmls\)/)
  assert.match(me, /body\.licenseStates !== undefined/)
  assert.match(me, /updateData\.licenseStates = statesResult\.states/)
})

test('BROKER_EDITABLE_FIELDS allowlist includes nmls and licenseStates', () => {
  const policy = read('lib/broker-policy.ts')
  assert.match(policy, /'nmls'/)
  assert.match(policy, /'licenseStates'/)
})

// ---------------------------------------------------------------------------
// Admin broker create/edit
// ---------------------------------------------------------------------------

test('admin broker create normalizes and persists licenseStates', () => {
  const lib = read('lib/admin-broker.ts')
  const route = read('app/api/admin/brokers/route.ts')
  assert.match(lib, /normalizeLicenseStates\(input\.licenseStates\)/)
  assert.match(lib, /NMLS ID must be 4–10 digits/)
  assert.match(route, /licenseStates: Array\.isArray\(body\.licenseStates\)/)
  assert.match(route, /licenseStates: input\.licenseStates/)
})

test('admin broker PATCH accepts and validates licenseStates + nmls', () => {
  const patch = read('app/api/admin/brokers/[id]/route.ts')
  assert.match(patch, /'licenseStates'/)
  assert.match(patch, /validateLicenseStates\(data\.licenseStates\)/)
  assert.match(patch, /NMLS ID must be 4–10 digits/)
})

test('admin broker forms expose NMLS and License States with the canonical US list', () => {
  const createForm = read('app/admin/brokers/create/AdminBrokerForm.tsx')
  const actions = read('app/admin/brokers/[id]/AdminBrokerActions.tsx')
  assert.match(createForm, /NMLS ID/)
  assert.match(createForm, /License States/)
  assert.match(createForm, /US_STATES/)
  assert.match(actions, /NMLS ID/)
  assert.match(actions, /License States/)
  assert.match(actions, /US_STATES/)
})

// ---------------------------------------------------------------------------
// Self-service uploads (authorization + no Media Picker)
// ---------------------------------------------------------------------------

test('self-service profile-image route derives the broker from the authenticated user', () => {
  const route = read('app/api/brokers/me/profile-image/route.ts')
  assert.match(route, /role !== "BROKER"/)
  assert.match(route, /findFirst\(\{ where: \{ userId: user\.id \} \}\)/)
  assert.doesNotMatch(route, /body\.brokerId|body\.userId|params/)
})

test('self-service cover-image route exists and derives the broker from the authenticated user', () => {
  assert.ok(exists('app/api/brokers/me/cover-image/route.ts'), 'self-service cover-image route missing')
  const route = read('app/api/brokers/me/cover-image/route.ts')
  assert.match(route, /role !== "BROKER"/)
  assert.match(route, /findFirst\(\{ where: \{ userId: user\.id \} \}\)/)
  assert.match(route, /uploadBrokerCoverImage/)
  assert.doesNotMatch(route, /body\.brokerId|body\.userId/)
})

test('broker profile image/cover uploads reuse the shared validated upload pipeline', () => {
  const profile = read('lib/broker-profile-image.ts')
  const cover = read('lib/broker-cover-image.ts')
  const shared = read('lib/image-upload.ts')
  assert.match(profile, /validateImageFile/)
  assert.match(cover, /validateImageFile/)
  // The shared pipeline validates MIME, size, real image content (sharp), safe
  // filenames (UUID), and guards path traversal.
  assert.match(shared, /Unsupported image format\./)
  assert.match(shared, /Image is too large\./)
  assert.match(shared, /is not a valid image\./)
  assert.match(shared, /crypto\.randomUUID\(\)\}\.webp/)
  assert.match(shared, /assertSafeCategory/)
})

test('broker-facing edit exposes a profile-image upload and no cover-image upload', () => {
  const edit = read('components/sections/broker/EditProfile.tsx')
  assert.doesNotMatch(edit, /MediaPickerDialog|MediaPicker/)
  assert.doesNotMatch(edit, /mediaSelectUrl/)
  assert.doesNotMatch(edit, /CoverImageUpload/)
  assert.doesNotMatch(edit, /\/api\/brokers\/me\/cover-image/)
  assert.match(edit, /\/api\/brokers\/me\/profile-image/)
  assert.doesNotMatch(edit, /GST|Aadhaar|indianCities|Permanent Account Number/)
})

test('admin Media Picker remains available in the admin broker detail page', () => {
  const actions = read('app/admin/brokers/[id]/AdminBrokerActions.tsx')
  assert.match(actions, /mediaSelectUrl=/)
  assert.match(actions, /\/cover-image\/media/)
})

test('broker profile fields remain separate: profileImage and coverImage are broker-owned', () => {
  const schema = read('prisma/schema.prisma')
  assert.match(schema, /profileImage\s+String\?/)
  assert.match(schema, /coverImage\s+String\?/)
  assert.match(schema, /licenseStates\s+String\[\]\s+@default\(\[\]\)/)
})

// ---------------------------------------------------------------------------
// Public exposure + India terms removed
// ---------------------------------------------------------------------------

test('public broker DTO exposes NMLS/license states but never India-era registration numbers', () => {
  const pub = read('lib/public-broker.ts')
  // NMLS + licensed states are public professional identity (the detail page
  // renders "NMLS #..." and the listing grid card does too). India-era internal
  // registration/pan numbers are never public.
  assert.match(pub, /nmls: str\(broker\.nmls\)/)
  assert.match(pub, /licenseStates: Array\.isArray\(broker\.licenseStates\)/)
  assert.doesNotMatch(pub, /registrationNumber/)
  assert.doesNotMatch(pub, /panNumber/)
})

test('owner DTO exposes nmls and licenseStates', () => {
  const dto = read('lib/broker-owner-dto.ts')
  assert.match(dto, /nmls: string \| null/)
  assert.match(dto, /licenseStates: string\[\]/)
  assert.match(dto, /nmls: broker\.nmls/)
  assert.match(dto, /licenseStates: broker\.licenseStates/)
})

test('active broker UI contains no India-specific licensing terminology', () => {
  const files = [
    'components/sections/broker/BrokerSetupWizard.tsx',
    'components/sections/broker/EditProfile.tsx',
    'components/sections/broker/CompanyProfile.tsx',
    'app/admin/brokers/create/AdminBrokerForm.tsx',
    'app/admin/brokers/[id]/AdminBrokerActions.tsx',
  ]
  for (const file of files) {
    const content = read(file)
    assert.doesNotMatch(content, /GST|gstNumber|Aadhaar|aadhaarCard|indianCities|Permanent Account Number/, `${file} must not contain India-specific licensing fields`)
  }
})