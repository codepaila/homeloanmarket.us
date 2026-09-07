import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { formatSelectedLocation, type SelectedUSLocation } from '../components/location/USLocationPicker'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
const picker = read('components/location/USLocationPicker.tsx')

// ===========================================================================
// 1/2/3. DISPLAY — single clean label, duplicates collapsed
// ===========================================================================

test('DISPLAY: place-level result (Dallas, TX) renders once, never duplicated', () => {
  const loc: SelectedUSLocation = { placeId: 'p', normalizedAddress: 'Dallas, TX', city: 'Dallas', state: 'TX', zip: '75201', latitude: 32.7, longitude: -96.8 }
  assert.equal(formatSelectedLocation(loc), 'Dallas, TX 75201')
  assert.equal(formatSelectedLocation(loc).includes(':'), false)
})

test('DISPLAY: full address + city/state shows the full meaningful address once', () => {
  const loc: SelectedUSLocation = { placeId: 'p', normalizedAddress: '123 Main St, Dallas, TX', city: 'Dallas', state: 'TX', zip: '75201', latitude: 32.7, longitude: -96.8 }
  assert.equal(formatSelectedLocation(loc), '123 Main St, Dallas, TX')
})

test('DISPLAY: the picker confirmation panel uses the formatter (no colon duplication)', () => {
  assert.match(picker, /formatSelectedLocation\(value\)/)
  // The old concatenation that produced "Dallas, TX · Dallas, TX" is gone.
  assert.doesNotMatch(picker, /value\.normalizedAddress\} · \{value\.city/)
})

test('DISPLAY: empty address falls back to city/state', () => {
  const loc: SelectedUSLocation = { placeId: 'p', normalizedAddress: '', city: 'Dallas', state: 'TX', zip: '', latitude: 32.7, longitude: -96.8 }
  assert.equal(formatSelectedLocation(loc), 'Dallas, TX')
})

// ===========================================================================
// 4/5. CLEAR — canonical location + all derived fields cleared
// ===========================================================================

test('CLEAR: wizard onChange(undefined) clears location and every derived field', () => {
  const clearBlock = wizard.slice(wizard.indexOf('} else {'), wizard.indexOf('}}'))
  assert.match(clearBlock, /form\.setValue\('officeAddress', ''\)/)
  assert.match(clearBlock, /form\.setValue\('city', ''\)/)
  assert.match(clearBlock, /form\.setValue\('state', ''\)/)
  assert.match(clearBlock, /form\.setValue\('pinCode', ''\)/)
  // Canonical reset: the location must be set to `undefined` (setValue), NOT
  // reset with resetField. resetField restores defaultValues, which merge the
  // persisted draft (`...restoreInitialData(initialData)`), so a saved location
  // would be rehydrated after Clear. setValue(undefined) keeps the cleared
  // value authoritative so Dallas/default never reappears.
  assert.match(clearBlock, /form\.setValue\('location', undefined\)/)
  assert.doesNotMatch(clearBlock, /form\.resetField\('location'\)/)
})

test('CLEAR: picker clear() empties input, suggestions, error, and calls onChange(undefined)', () => {
  const clearFn = picker.slice(picker.indexOf('function clear()'), picker.indexOf('\n  return ('))
  assert.match(clearFn, /setInput\(''\)/)
  assert.match(clearFn, /setSuggestions\(\[\]\)/)
  assert.match(clearFn, /setError\(''\)/)
  assert.match(clearFn, /onChange\(undefined\)/)
})

test('CLEAR: the confirmation panel only renders for a real selected place (placeId present)', () => {
  // The panel is gated on `value && value.placeId`, so after Clear (value
  // undefined) — or any stale object without a placeId — no selected-location
  // display can remain.
  assert.match(picker, /\{value && value\.placeId \?/)
})

test('CLEAR: the picker input is seeded from value once and cleared by user actions (no prop-sync loop)', () => {
  // The input is seeded once from the canonical value (draft resume) via the
  // useState initializer. It is NOT synchronized from `value` on every render
  // (which caused the Phase 8.24.4 infinite re-render) nor in an effect (which
  // would erase the user's typing, since typing calls onChange(undefined)).
  assert.match(picker, /useState\(value\?\.normalizedAddress \|\| ''\)/)
  assert.doesNotMatch(picker, /lastValueAddress/)
  // clear() empties the input directly.
  const clearFn = picker.slice(picker.indexOf('function clear()'), picker.indexOf('\n  return ('))
  assert.match(clearFn, /setInput\(''\)/)
})

test('CLEAR: no duplicate location state system introduced (input/suggestions/error only)', () => {
  // The picker keeps only transient UI state (`input`, `suggestions`, `error`);
  // the selected location lives in the single `value` prop (form location). The
  // old `lastValueAddress` render-body tracker is gone, and no parallel
  // selected-place system exists.
  assert.doesNotMatch(picker, /lastValueAddress/)
  assert.doesNotMatch(picker, /selectedPlace|selectedLocation\s*=\s*useState/)
  const stateNames = ['input', 'suggestions', 'error']
  for (const name of stateNames) assert.match(picker, new RegExp(`\\[${name}, set${name[0].toUpperCase()}${name.slice(1)}\\]`))
  assert.match(picker, /value\?: SelectedUSLocation/)
  assert.match(picker, /onChange: \(location\?: SelectedUSLocation\) => void/)
})

test('RERENDER-SAFETY: no setState runs directly in the render body (Phase 8.24.4 regression)', () => {
  // A `if (prop !== state) setState(...)` block in the render body forces an
  // infinite re-render when the comparison never converges (e.g. undefined vs
  // ''). The input sync is now deferred to an effect.
  assert.doesNotMatch(picker, /if \(value\?\.normalizedAddress !== lastValueAddress\)/)
  assert.doesNotMatch(picker, /setInput\(value\?\.normalizedAddress \|\| ''\)/)
  assert.doesNotMatch(picker, /setLastValueAddress/)
})

// ===========================================================================
// 6/7. VALIDATION AFTER CLEAR + RE-SELECTION
// ===========================================================================

test('VALIDATION: after clearing, Step 4 is invalid and the location-required toast fires', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const invalidBlock = handleNext.slice(handleNext.indexOf('if (!isValid)'), handleNext.indexOf('if (currentStep < steps.length)'))
  assert.match(invalidBlock, /Please select your office location from the Google suggestions\./)
  assert.doesNotMatch(invalidBlock, /setCurrentStep\(prev => prev \+ 1\)/)
  // Step 4 validation still requires the location object with a placeId.
  const locSchema = wizard.slice(wizard.indexOf('const locationSchema'), wizard.indexOf('const registrationSchema'))
  assert.match(locSchema, /placeId: z\.string\(\)/)
  assert.match(locSchema, /Boolean\(value\.placeId\)/)
})

test('VALIDATION: selecting a location derives the address fields and makes the step valid', () => {
  // Google-derived values replace previous ones, preserving any manually
  // entered fallback only when the new result is missing that field.
  assert.match(wizard, /form\.setValue\('officeAddress', location\.normalizedAddress \|\|/)
  assert.match(wizard, /form\.setValue\('city', location\.city \|\|/)
  assert.match(wizard, /form\.setValue\('state', location\.state \|\|/)
  assert.match(wizard, /form\.setValue\('pinCode', location\.zip \|\|/)
})

test('VALIDATION: a valid location still advances Step 4 -> Review after a successful save', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const afterSave = handleNext.slice(handleNext.indexOf('if (currentStep < steps.length)'), handleNext.indexOf('const handleBack'))
  assert.match(afterSave, /setCurrentStep\(prev => prev \+ 1\)/)
  assert.match(afterSave, /if \(!response\.ok\) throw new Error/)
})

test('VALIDATION: typed text without a Google suggestion stays invalid (onChange(undefined) on input edit)', () => {
  assert.match(picker, /onChange=\{\(event\) => \{ setInput\(event\.target\.value\); setSuggestions\(\[\]\); onChange\(undefined\) \}\}/)
})