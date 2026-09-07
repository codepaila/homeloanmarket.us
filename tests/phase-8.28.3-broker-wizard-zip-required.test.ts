import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
const brokerLocationLib = read('lib/location/broker-location.ts')
const brokerRegLib = read('lib/broker-registration.ts')
const brokersRoute = read('app/api/brokers/route.ts')

const locSchema = wizard.slice(wizard.indexOf('const locationSchema'), wizard.indexOf('const registrationSchema'))
const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
const invalidBlock = handleNext.slice(handleNext.indexOf('if (!isValid)'), handleNext.indexOf('if (currentStep < steps.length)'))

// ===========================================================================
// Phase 8.28.3 — ZIP Code is required to advance from the Location step.
// ===========================================================================

test('1. EMPTY ZIP: the Location schema requires ZIP with inline "ZIP Code is required."', () => {
  assert.match(locSchema, /pinCode: z\.string\(\)\.trim\(\)\.min\(1, 'ZIP Code is required\.'\)/)
})

test('2. WHITESPACE ZIP: whitespace is trimmed before the required check', () => {
  assert.match(locSchema, /\.trim\(\)\.min\(1, 'ZIP Code is required\.'\)/)
})

test('1. EMPTY ZIP: Step 4 Next validates pinCode at the advance boundary (same boundary that advances steps)', () => {
  assert.match(handleNext, /case 4:\s*isValid = await form\.trigger\(\[\s*'location', 'officeAddress', 'city', 'state', 'pinCode'\]\)/)
  // The advance only happens after isValid (no silent progression on failure).
  assert.doesNotMatch(invalidBlock, /setCurrentStep\(prev => prev \+ 1\)/)
})

test('3. VALID ZIP: the shared isValidUsZip rule (5 digits or 5+4) is reused, not redefined', () => {
  assert.match(wizard, /import \{ isValidUsZip \} from '@\/lib\/location\/broker-location'/)
  assert.match(locSchema, /\.refine\(isValidUsZip/)
  // The canonical shared validator exists once in broker-location.
  assert.ok(brokerLocationLib.includes('const US_ZIP_PATTERN = /^\\d{5}(-\\d{4})?$/'), 'canonical US ZIP pattern exists once')
  assert.match(brokerLocationLib, /isValidUsZip\(value/)
})

test('4. GOOGLE ZIP: selecting a place autofills the ZIP into the pinCode field', () => {
  assert.match(wizard, /form\.setValue\('pinCode', location\.zip \|\|/)
})

test('5. GOOGLE MISSING ZIP: an empty ZIP blocks Next, stays on the step, and focuses the ZIP field', () => {
  assert.match(invalidBlock, /!zip/)
  assert.match(invalidBlock, /form\.setFocus\('pinCode'\)/)
  assert.doesNotMatch(invalidBlock, /setCurrentStep\(prev => prev \+ 1\)/)
})

test('5. GOOGLE MISSING ZIP: an invalid manual ZIP also focuses the field with the format message', () => {
  assert.match(invalidBlock, /Please enter a valid US ZIP code\./)
  assert.match(invalidBlock, /form\.setFocus\('pinCode'\)/)
})

test('6. MANUAL ENTRY: typing a valid ZIP clears the error (schema resolver passes once valid)', () => {
  // The schema requires a non-empty trimmed value AND a valid US ZIP; once the
  // value is valid the resolver stops producing the inline field error, so
  // Next becomes available again without leaving the step.
  assert.match(locSchema, /min\(1, 'ZIP Code is required\.'\)/)
  assert.match(locSchema, /\.refine\(isValidUsZip/)
  assert.doesNotMatch(locSchema, /pinCode: z\.string\(\)\.optional\(\)\.or\(z\.literal\(''\)\)/)
  // The ZIP input clears the stale inline error the moment the typed value is a
  // valid US ZIP (isValidUsZip), so "ZIP Code is required." never lingers after
  // the user corrects the field.
  assert.match(wizard, /if \(isValidUsZip\(event\.target\.value\)\) form\.clearErrors\('pinCode'\)/)
  // A Google-provided (or preserved manual) ZIP that is now valid also clears a
  // stale inline error immediately on reselect.
  assert.match(wizard, /if \(isValidUsZip\(form\.getValues\('pinCode'\)\)\) form\.clearErrors\('pinCode'\)/)
})

test('7. BACK NAVIGATION: going backward is never blocked (no validation on handleBack)', () => {
  assert.match(wizard, /const handleBack = \(\) => \{\s*if \(currentStep > 1\)/)
  const backBlock = wizard.slice(wizard.indexOf('const handleBack'), wizard.indexOf('const onSubmit'))
  assert.doesNotMatch(backBlock, /trigger|validate|isValid/)
})

test('8. DATA PRESERVATION: a ZIP validation failure never resets the other location fields', () => {
  // The invalid block only toasts + scrolls + focuses; it never resets the
  // form or wipes the derived address/city/state values.
  assert.doesNotMatch(invalidBlock, /form\.reset\(/)
  assert.doesNotMatch(invalidBlock, /setValue\('officeAddress', ''\)/)
  assert.doesNotMatch(invalidBlock, /setValue\('city', ''\)/)
  assert.doesNotMatch(invalidBlock, /setValue\('state', ''\)/)
})

test('9. SERVER SAFETY: finalization still rejects a missing/invalid US ZIP (authoritative layer)', () => {
  assert.match(brokerLocationLib, /isValidUsZip\(resolved\.zip\)/)
  assert.match(brokerLocationLib, /A valid US ZIP code could not be determined/)
  assert.match(brokersRoute, /requireValidResolvedUSLocation\(resolvedLocation\)/)
  assert.match(brokerRegLib, /pinCode = location\?\.zip/)
})