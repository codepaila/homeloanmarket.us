import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
const setup = read('app/setup/page.tsx')
const brokerRegLib = read('lib/broker-registration.ts')
const googlePlaceLib = read('lib/location/google-place.ts')
const brokerLocationLib = read('lib/location/broker-location.ts')
const picker = read('components/location/USLocationPicker.tsx')
const brokersRoute = read('app/api/brokers/route.ts')

// ===========================================================================
// 1. NO DEFAULT LOCATION for a new registration
// ===========================================================================

test('NO DEFAULT: a new registration starts with an empty location and empty derived fields', () => {
  // createBrokerRegistration seeds an empty draft.
  assert.match(brokerRegLib, /draft: \{\s*create: \{\s*data: \{\},\s*currentStep: 1/)
  // The wizard's defaultValues keep location/derived fields empty.
  const defaultsBlock = wizard.slice(wizard.indexOf('defaultValues: {'), wizard.indexOf('...restoreInitialData(initialData)'))
  assert.match(defaultsBlock, /location: undefined/)
  assert.match(defaultsBlock, /officeAddress: ''/)
  assert.match(defaultsBlock, /city: ''/)
  assert.match(defaultsBlock, /state: ''/)
  assert.match(defaultsBlock, /pinCode: ''/)
  // No hardcoded default place is ever injected into the form.
  assert.doesNotMatch(wizard, /setValue\('location', \{/)
  assert.doesNotMatch(wizard, /location: \{\s*placeId/)
})

test('NO DEFAULT: the picker input is empty when no location is selected', () => {
  assert.match(picker, /useState\(value\?\.normalizedAddress \|\| ''\)/)
})

test('NO DEFAULT: /setup feeds only the persisted draft into the wizard', () => {
  assert.match(setup, /draft\.data/)
  assert.match(setup, /initialData=\{initialData\}/)
})

// ===========================================================================
// 2. SAVED LOCATION RESTORES on resume
// ===========================================================================

test('RESTORE: a saved draft location is restored through initialData', () => {
  assert.match(wizard, /restoreInitialData\(initialData\)/)
  assert.match(setup, /draft\?\.data && typeof draft\.data === 'object'/)
})

// ===========================================================================
// 3/4. SELECTION MAPPING + DERIVED FIELDS
// ===========================================================================

test('SELECT: picking a place derives officeAddress/city/state/pinCode with manual fallback preservation', () => {
  const selectBlock = wizard.slice(wizard.indexOf('onChange={(location) => {'), wizard.indexOf('}}'))
  // Google-derived values replace previous ones, but where the new result is
  // missing a field the current (possibly manually entered) value is kept.
  assert.match(selectBlock, /form\.setValue\('officeAddress', location\.normalizedAddress \|\|/)
  assert.match(selectBlock, /form\.setValue\('city', location\.city \|\|/)
  assert.match(selectBlock, /form\.setValue\('state', location\.state \|\|/)
  assert.match(selectBlock, /form\.setValue\('pinCode', location\.zip \|\|/)
})

test('SELECT: an office-level place produces a complete SelectedUSLocation (incl. zip)', () => {
  assert.match(googlePlaceLib, /postal_code/) 
  assert.match(googlePlaceLib, /administrative_area_level_1/)
  assert.match(googlePlaceLib, /locality/)
})

test('SELECT: finalization requires a valid US ZIP for the broker office', () => {
  assert.match(brokerLocationLib, /A valid US ZIP code could not be determined/)
  assert.match(brokerLocationLib, /isValidUsZip\(resolved\.zip\)/)
  assert.match(brokersRoute, /requireValidResolvedUSLocation\(resolvedLocation\)/)
})

// ===========================================================================
// 6. CITY-LEVEL RESULTS — intentional, accurate handling
// ===========================================================================

test('CITY-LEVEL: a place without a ZIP is treated as a manual-ZIP fallback (clear message)', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const invalidBlock = handleNext.slice(handleNext.indexOf('if (!isValid)'), handleNext.indexOf('if (currentStep < steps.length)'))
  assert.match(invalidBlock, /Google couldn't detect the ZIP code\. Please enter it to continue\./)
  // The misleading generic message must not be shown for this case.
  assert.doesNotMatch(invalidBlock, /We couldn't read all details from this location\. Please select the location again\./)
})

test('CITY-LEVEL: the wizard exposes a manual ZIP fallback and requires a valid 5-digit or ZIP+4', () => {
  const locSchema = wizard.slice(wizard.indexOf('const locationSchema'), wizard.indexOf('const registrationSchema'))
  // ZIP is required at the schema level (inline "ZIP Code is required." error on
  // the field), reusing the shared isValidUsZip rule (5 digits or 5+4). The
  // other derived fields stay optional and are validated as a group in
  // handleNext with actionable per-field toasts.
  assert.match(locSchema, /pinCode: z\.string\(\)\.trim\(\)\.min\(1, 'ZIP Code is required\.'\)\.refine\(isValidUsZip/)
  // A valid ZIP is 5 digits or 5+4 (e.g. 12345-6789), enforced in handleNext too.
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const invalidBlock = handleNext.slice(handleNext.indexOf('if (!isValid)'), handleNext.indexOf('if (currentStep < steps.length)'))
  assert.match(invalidBlock, /\\d\{5\}\(-\\d\{4\}\)\?\$/)
})

// ===========================================================================
// 7. INCOMPLETE / UNRESOLVABLE — accurate toast
// ===========================================================================

test('TOAST: no location selected -> location-required message', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const invalidBlock = handleNext.slice(handleNext.indexOf('if (!isValid)'), handleNext.indexOf('if (currentStep < steps.length)'))
  assert.match(invalidBlock, /Please select your office location from the Google suggestions\./)
})

test('TOAST: placeId present but ZIP absent -> manual-ZIP message (not generic)', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const invalidBlock = handleNext.slice(handleNext.indexOf('if (!isValid)'), handleNext.indexOf('if (currentStep < steps.length)'))
  assert.match(invalidBlock, /!zip/)
  assert.match(invalidBlock, /Google couldn't detect the ZIP code\. Please enter it to continue\./)
})

// ===========================================================================
// 5/9/10/11. VALID ADVANCE + CLEAR + RESELECT REGRESSION
// ===========================================================================

test('ADVANCE: a valid office location with a ZIP passes Step 4 and advances on successful save', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const afterSave = handleNext.slice(handleNext.indexOf('if (currentStep < steps.length)'), handleNext.indexOf('const handleBack'))
  assert.match(afterSave, /setCurrentStep\(prev => prev \+ 1\)/)
  assert.match(afterSave, /if \(!response\.ok\) throw new Error/)
})

test('CLEAR: clearing still resets the canonical location + derived fields (Phase 8.24.2 regression)', () => {
  assert.match(wizard, /form\.setValue\('location', undefined\)/)
  assert.doesNotMatch(wizard, /form\.resetField\('location'\)/)
  assert.match(wizard, /form\.setValue\('officeAddress', ''\)/)
  assert.match(wizard, /form\.setValue\('city', ''\)/)
  assert.match(wizard, /form\.setValue\('state', ''\)/)
  assert.match(wizard, /form\.setValue\('pinCode', ''\)/)
  assert.match(picker, /function clear\(\)/)
  assert.match(picker, /onChange\(undefined\)/)
  // Panel only renders for a real placeId.
  assert.match(picker, /\{value && value\.placeId \?/)
})

// ===========================================================================
// PHASE 8.24.3 — CLEAR is authoritative: Dallas/default must NEVER reappear
// ===========================================================================

test('CLEAR-AUTHORITATIVE: setValue(undefined) — not resetField — is used so a saved draft location cannot be rehydrated', () => {
  // resetField restores defaultValues, which merge the persisted draft via
  // `...restoreInitialData(initialData)`. A saved location (e.g. Dallas, TX)
  // would therefore be re-seeded after Clear. setValue(undefined) keeps the
  // cleared value canonical and authoritative against any rerender/initialData.
  const clearStart = wizard.indexOf("form.setValue('officeAddress', '')")
  const clearBlock = wizard.slice(clearStart, wizard.indexOf("form.setValue('location', undefined)") + "form.setValue('location', undefined)".length)
  assert.match(clearBlock, /form\.setValue\('location', undefined\)/)
  assert.doesNotMatch(clearBlock, /resetField/)
})

test('CLEAR-AUTHORITATIVE: defaultValues spread the draft AFTER location:undefined, so a draft is the only possible source of a restored value', () => {
  // The explicit `location: undefined` default precedes `...restoreInitialData`,
  // confirming that the ONLY way a location becomes non-empty on a fresh render
  // is a genuinely persisted draft — never a hardcoded default.
  const defaultsBlock = wizard.slice(wizard.indexOf('defaultValues: {'), wizard.indexOf('...restoreInitialData(initialData)'))
  assert.match(defaultsBlock, /location: undefined/)
  assert.doesNotMatch(wizard, /defaultLocation|location \?\?|\?\?\s*\{/)
  assert.doesNotMatch(wizard, /location:\s*\{\s*normalizedAddress:\s*'/)
})

test('CLEAR-AUTHORITATIVE: no hardcoded/default location constant is injected anywhere in the wizard', () => {
  assert.doesNotMatch(wizard, /location: \{\s*placeId/)
  assert.doesNotMatch(wizard, /setValue\('location', \{/)
  assert.doesNotMatch(wizard, /setValue\('location', '[A-Za-z]/)
})

test('CLEAR-AUTHORITATIVE: on reselect the picker clears input/suggestions/error then derives fields again', () => {
  // select() empties prior transient state and re-derives from the resolved place.
  const selectFn = picker.slice(picker.indexOf('async function select'), picker.indexOf('\n  function clear'))
  assert.match(selectFn, /setError\(''\)/)
  assert.match(selectFn, /setSuggestions\(\[\]\)/)
  assert.match(selectFn, /onChange\(resolved\)/)
})

// ===========================================================================
// PHASE 8.24.3 — ZIP is genuinely required by the server contract
// ===========================================================================

test('ZIP-CONTRACT: ZIP is required because the server finalization rejects it, not as an arbitrary UI rule', () => {
  // A locality result (e.g. Daytona Beach, FL) has no postal_code component, so
  // zip=''. The authoritative server-side requireValidResolvedUSLocation()
  // rejects a missing/invalid ZIP, and POST /api/brokers enforces it. The UI
  // message is therefore accurate, and a specific street/business result
  // provides the ZIP.
  assert.match(brokerLocationLib, /A valid US ZIP code could not be determined/)
  assert.match(brokerLocationLib, /isValidUsZip\(resolved\.zip\)/)
  assert.match(brokersRoute, /requireValidResolvedUSLocation\(resolvedLocation\)/)
  // The resolver maps postal_code -> zip for a specific address result.
  assert.match(googlePlaceLib, /postal_code/)
  // The UI exposes a manual ZIP fallback and requires a valid 5-digit or ZIP+4
  // (mirrors the finalization contract) — an empty ZIP blocks Next inline.
  const locSchema = wizard.slice(wizard.indexOf('const locationSchema'), wizard.indexOf('const registrationSchema'))
  assert.match(locSchema, /pinCode: z\.string\(\)\.trim\(\)\.min\(1, 'ZIP Code is required\.'\)\.refine\(isValidUsZip/)
})

// ===========================================================================
// 12. FINALIZATION RECEIVES THE CORRECT LOCATION
// ===========================================================================

test('FINALIZE: broker finalization consumes the canonical location fields', () => {
  assert.match(brokerRegLib, /coordinates: \[location\.longitude, location\.latitude\]/)
  assert.match(brokerRegLib, /normalizedAddress: location\?\.normalizedAddress/)
  assert.match(brokerRegLib, /googlePlaceId: location\?\.placeId/)
  assert.match(brokerRegLib, /pinCode = location\?\.zip/)
})