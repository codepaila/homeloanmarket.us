import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const edit = read('components/sections/broker/EditProfile.tsx')
const page = read('app/broker/company/edit/page.tsx')
const me = read('app/api/brokers/me/route.ts')
const companyRoute = read('app/api/company/[slug]/route.ts')
const policy = read('lib/broker-policy.ts')
const brokerRegLib = read('lib/broker-registration.ts')
const picker = read('components/location/USLocationPicker.tsx')

// ===========================================================================
// PHASE 8.26.3 — profileSlug is SERVER-OWNED and IMMUTABLE
// ===========================================================================
// The broker company-profile EDIT page must never expose the slug, and no
// broker-facing endpoint may accept a client-supplied slug. The canonical slug
// is generated at finalization (lib/broker-registration.ts) from
// companyName/displayName and made unique; existing slugs never change.

test('SLUG: the edit form never renders or requires a profileSlug input', () => {
  // Schema, defaultValues, TAB_FIELDS, and the "Profile URL Slug" FormField
  // are all gone — the saved zod payload can no longer contain profileSlug.
  assert.doesNotMatch(edit, /profileSlug/)
  assert.doesNotMatch(edit, /Profile URL Slug/)
  // The client-side slug re-implementation (lowercase/sanitize) is gone too.
  assert.doesNotMatch(edit, /homeloanmarket\.com\//)
  assert.doesNotMatch(edit, /your-profile-name/)
})

test('SLUG: the company edit page DTO never ships profileSlug to the client', () => {
  assert.doesNotMatch(page, /profileSlug/)
})

test('SLUG: the owner PATCH /api/brokers/me ignores any client-supplied slug', () => {
  assert.doesNotMatch(me, /body\.profileSlug/)
  assert.doesNotMatch(me, /updateData\.profileSlug/)
  assert.doesNotMatch(me, /Profile slug is already taken/)
  // A comment documents the immutability contract.
  assert.match(me, /profileSlug is SERVER-GENERATED and IMMUTABLE/)
})

test('SLUG: the claimed-broker owner route can no longer mutate the slug', () => {
  // The explicit special-handling block (format check + uniqueness + write) is
  // removed; pickBrokerEditableFields drops profileSlug before we get here.
  assert.doesNotMatch(companyRoute, /updateData\.profileSlug/)
  assert.doesNotMatch(companyRoute, /Profile slug is already taken/)
  assert.match(companyRoute, /pickBrokerEditableFields\(/)
})

test('SLUG: BROKER_EDITABLE_FIELDS excludes profileSlug (system-managed field)', () => {
  const allowlist = policy.slice(policy.indexOf('export const BROKER_EDITABLE_FIELDS = ['), policy.indexOf('] as const') + 1)
  assert.doesNotMatch(allowlist, /profileSlug/)
})

test('SLUG: the canonical slug system stays authoritative for registration', () => {
  // Server-generates the slug from companyName/displayName, makes it unique
  // with a numeric suffix, and never trusts a client-supplied value.
  assert.match(brokerRegLib, /export function slugifyBrokerName/)
  assert.match(brokerRegLib, /while \(await tx\.broker\.findUnique\(\{ where: \{ profileSlug \} \}\)\)/)
  assert.doesNotMatch(brokerRegLib, /merged\.profileSlug\.trim\(\) \? slugifyBrokerName\(merged\.profileSlug/)
})

test('SLUG: the public broker profile link still uses the canonical profileSlug (read-only routing)', () => {
  const profile = read('components/sections/broker/BrokerProfile.tsx')
  const dashboard = read('components/sections/broker/BrokerDashboard.tsx')
  assert.match(profile, /href=\{`\/brokers\/\$\{broker\?\.profileSlug\}`\}/)
  assert.match(dashboard, /currentBroker\.profileSlug/)
})

// ===========================================================================
// PHASE 8.26.3 — ONE canonical Office Location editing experience
// ===========================================================================
// The edit surface must contain exactly one Google location picker and one
// structured address set (officeAddress/city/state/pinCode). Selecting a place
// derives the structured fields (preserving any manual fallback for fields the
// new result is missing); the explicit "Clear location" action resets EVERY
// derived field; a manual address edit never keeps a stale Google selection.

test('LOCATION: the edit form renders exactly ONE USLocationPicker', () => {
  assert.equal((edit.match(/<USLocationPicker/g) || []).length, 1)
  assert.equal((edit.match(/name="location"/g) || []).length, 1)
  // Exactly one canonical structured address set, never a legacy zipCode field.
  for (const field of ['officeAddress', 'city', 'state', 'pinCode']) {
    assert.equal((edit.match(new RegExp(`name="${field}"`, 'g')) || []).length, 1, `${field} must have exactly one input`)
  }
  assert.doesNotMatch(edit, /name="zipCode"/)
  assert.doesNotMatch(edit, /zipCode: broker\?\.zipCode/)
})

test('LOCATION: selecting a place derives all four fields, preserving manual fallback', () => {
  // Google-derived values replace previous ones; where the new result is
  // missing a field the current (possibly manually entered) value survives.
  assert.match(edit, /form\.setValue\('officeAddress', location\.normalizedAddress \|\| \(prev\.officeAddress \|\| ''\)\)/)
  assert.match(edit, /form\.setValue\('city', location\.city \|\| \(prev\.city \|\| ''\)\)/)
  assert.match(edit, /form\.setValue\('state', location\.state \|\| \(prev\.state \|\| ''\)\)/)
  assert.match(edit, /form\.setValue\('pinCode', location\.zip \|\| \(prev\.pinCode \|\| ''\)\)/)
})

test('LOCATION: explicit Clear location resets every derived address field', () => {
  // Wired through the picker's onClear (fires only for the explicit Clear
  // action — never for typing), so no stale address text survives a clear.
  assert.match(edit, /onClear=\{\(\) => \{/)
  assert.match(edit, /form\.setValue\('officeAddress', ''\)/)
  assert.match(edit, /form\.setValue\('city', ''\)/)
  assert.match(edit, /form\.setValue\('state', ''\)/)
  assert.match(edit, /form\.setValue\('pinCode', ''\)/)
  // The picker itself clears input/suggestions/error and the canonical value.
  assert.match(picker, /function clear\(\)/)
  assert.match(picker, /onChange\(undefined\)/)
})

test('LOCATION: manual edits of any address field invalidate the Google selection', () => {
  // officeAddress, city, state, and pinCode all clear the place on change so a
  // stale Google selection can never be saved alongside different text.
  const occurrences = (edit.match(/form\.setValue\('location', undefined\)/g) || []).length
  assert.ok(occurrences >= 4, `expected >=4 place-invalidations, got ${occurrences}`)
})

test('LOCATION: ZIP validates as 5 digits or ZIP+4 (canonical US contract)', () => {
  assert.match(edit, /pinCode: z\.string\(\)\.regex\(/)
  assert.match(edit, /ZIP Code must be 5 digits or 5\+4/)
  assert.doesNotMatch(edit, /pinCode: z\.string\(\)\.length\(5/)
})

test('LOCATION: the owner PATCH keeps the canonical place/address contract', () => {
  // A placeId re-resolves and derives the structured fields; address changes
  // without a place clear stale coordinates. (Regression guard.)
  assert.match(me, /resolveUSPlace\(placeId\)/)
  assert.match(me, /requireValidResolvedUSLocation\(resolved\)/)
  assert.match(me, /updateData\.googlePlaceId = null/)
  assert.match(me, /updateData\.location = Prisma\.DbNull/)
  assert.match(me, /else if \(body\.zipCode !== undefined\)/)
})