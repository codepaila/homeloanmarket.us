import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
const picker = read('components/location/USLocationPicker.tsx')

// ===========================================================================
// PHASE 8.24.4 — LOCATION / PROFILE SAVE SUCCESS FEEDBACK
// ===========================================================================

test('SAVE-TOAST: the Location step success toast fires only after the PATCH response is ok', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const saveBlock = handleNext.slice(handleNext.indexOf('if (currentStep < steps.length)'), handleNext.indexOf('catch (error)'))
  // The response must be checked (throw on non-ok) BEFORE the success toast.
  assert.match(saveBlock, /if \(!response\.ok\) throw new Error/)
  assert.match(saveBlock, /toast\.success\(STEP_SUCCESS_MESSAGES\[currentStep\]\)/)
  const okIndex = saveBlock.indexOf('if (!response.ok)')
  const toastIndex = saveBlock.indexOf('toast.success(STEP_SUCCESS_MESSAGES[currentStep])')
  assert.ok(toastIndex > okIndex, 'success toast must come after the response check')
})

test('SAVE-TOAST: each step has its own success message, Location included', () => {
  assert.match(wizard, /4: 'Office location saved successfully\.'/)
  assert.match(wizard, /1: 'Basic profile saved successfully\.'/)
  assert.match(wizard, /2: 'Contact information saved successfully\.'/)
  assert.match(wizard, /3: 'Professional details saved successfully\.'/)
})

test('SAVE-TOAST: success toast is emitted once inside the guarded save (not in an effect/loop)', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const saveBlock = handleNext.slice(handleNext.indexOf('if (currentStep < steps.length)'), handleNext.indexOf('catch (error)'))
  // The toast lives inside the try, gated by savingStep double-submit protection.
  assert.match(saveBlock, /if \(savingStep\) return/)
  assert.match(saveBlock, /setSavingStep\(true\)/)
  assert.match(saveBlock, /toast\.success\(STEP_SUCCESS_MESSAGES\[currentStep\]\)/)
  // No success toast inside an effect body (would fire repeatedly on rerenders).
  assert.doesNotMatch(wizard, /useEffect\([\s\S]{0,80}toast\.success/)
})

test('SAVE-TOAST: a failed Location PATCH keeps the established failure message and never advances', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const catchBlock = handleNext.slice(handleNext.indexOf('catch (error)'))
  assert.match(catchBlock, /We couldn't save your location\. Please try again\./)
  assert.doesNotMatch(catchBlock, /setCurrentStep/)
})

test('FINALIZE-TOAST: broker completion shows a success toast only after POST /api/brokers returns ok', () => {
  const onSubmit = wizard.slice(wizard.indexOf('const onSubmit'), wizard.indexOf('const renderStep'))
  assert.match(onSubmit, /if \(!response\.ok\)/)
  assert.match(onSubmit, /toast\.success\('Your broker profile is ready\.'\)/)
  const okIndex = onSubmit.indexOf('if (!response.ok)')
  const toastIndex = onSubmit.indexOf("toast.success('Your broker profile is ready.')")
  assert.ok(toastIndex > okIndex, 'completion success toast must come after the response check')
  // Failure path preserves entered data (no form reset) and allows retry.
  assert.match(onSubmit, /catch \(error: any\)/)
  assert.match(onSubmit, /toast\.error\(error\?\.message/)
  assert.doesNotMatch(onSubmit, /form\.reset\(\)/)
})

// ===========================================================================
// PHASE 8.24.4 — EXPLICIT CLEAR PERSISTENCE (Dallas must not return)
// ===========================================================================

// Mirrors the onboarding route's draft merge end-to-end: the CLIENT serializes
// the payload to JSON (dropping any `undefined` keys), the server parses that
// body, copies only DRAFT_FIELDS that are present (`field in body`), then
// merges over the existing draft and re-serializes. This is the authoritative
// proof that a cleared location (null) removes a stale saved location, while
// `undefined` is dropped during request serialization and Dallas survives.
const DRAFT_FIELDS = ['location', 'officeAddress', 'city', 'state', 'pinCode']
function routeMerge(oldDraft: Record<string, unknown>, payload: Record<string, unknown>) {
  const body = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>
  const data: Record<string, unknown> = {}
  for (const field of DRAFT_FIELDS) {
    if (field in body) data[field] = body[field]
  }
  return JSON.parse(JSON.stringify({ ...oldDraft, ...data })) as Record<string, unknown>
}

test('CLEAR-PERSIST-MERGE: location:null removes a stale saved location (Dallas) from the persisted draft', () => {
  const persisted = routeMerge(
    { location: { placeId: 'p', normalizedAddress: 'Dallas, TX', city: 'Dallas', state: 'TX', zip: '75201' }, pinCode: '75201' },
    { location: null, officeAddress: '', city: '', state: '', pinCode: '' },
  )
  assert.equal(persisted.location, null, 'the cleared location must persist as null')
  assert.equal(persisted.pinCode, '')
  assert.equal(persisted.city, '')
  assert.equal(persisted.state, '')
  assert.equal(persisted.officeAddress, '')
})

test('CLEAR-PERSIST-MERGE: location:undefined is dropped during request serialization so Dallas survives (why null is used)', () => {
  const persisted = routeMerge(
    { location: { placeId: 'p', normalizedAddress: 'Dallas, TX', city: 'Dallas', state: 'TX', zip: '75201' } },
    { location: undefined, pinCode: '' },
  )
  // The server never receives the `location` key, so the stale Dallas location
  // remains in the merged draft — this is exactly why null is sent instead.
  assert.deepEqual(persisted.location, { placeId: 'p', normalizedAddress: 'Dallas, TX', city: 'Dallas', state: 'TX', zip: '75201' })
})

test('CLEAR-PERSIST-MERGE: a new location replaces the cleared draft location on the next save', () => {
  const persisted = routeMerge(
    { location: null, city: '', state: '', pinCode: '' },
    { location: { placeId: 'new', normalizedAddress: '123 Main St, Daytona Beach, FL 32114', city: 'Daytona Beach', state: 'FL', zip: '32114' }, pinCode: '32114' },
  )
  assert.deepEqual(persisted.location, { placeId: 'new', normalizedAddress: '123 Main St, Daytona Beach, FL 32114', city: 'Daytona Beach', state: 'FL', zip: '32114' })
  assert.equal(persisted.pinCode, '32114')
})

test('CLEAR-PERSIST: the picker exposes onClear and fires it ONLY from the explicit Clear button', () => {
  assert.match(picker, /onClear\?: \(\) => void/)
  const clearFn = picker.slice(picker.indexOf('function clear()'), picker.indexOf('\n  return ('))
  assert.match(clearFn, /onClear\?\.\(\)/)
  // Typing calls onChange(undefined) but must NOT fire onClear (would PATCH on
  // every keystroke).
  assert.match(picker, /onChange=\{\(event\) => \{ setInput\(event\.target\.value\); setSuggestions\(\[\]\); onChange\(undefined\) \}\}/)
  assert.doesNotMatch(picker, /onChange=\{\(event\) => \{[\s\S]{0,60}onClear/)
})

test('CLEAR-PERSIST: the wizard persists the cleared location as null + empty derived fields', () => {
  const fn = wizard.slice(wizard.indexOf('const persistClearedLocation'), wizard.indexOf('const handleNext'))
  assert.match(fn, /location: null/)
  assert.match(fn, /officeAddress: ''/)
  assert.match(fn, /city: ''/)
  assert.match(fn, /state: ''/)
  assert.match(fn, /pinCode: ''/)
  assert.match(fn, /currentStep/)
  // Same canonical save endpoint is reused — no second save API.
  assert.match(fn, /fetch\('\/api\/broker-registration\/onboarding'/)
})

test('CLEAR-PERSIST: the cleared location is guarded so it cannot race a Next save', () => {
  const fn = wizard.slice(wizard.indexOf('const persistClearedLocation'), wizard.indexOf('const handleNext'))
  assert.match(fn, /if \(savingStep\) return/)
  assert.match(fn, /setSavingStep\(true\)/)
  assert.match(fn, /finally \{\s*setSavingStep\(false\)/)
})

test('CLEAR-PERSIST: Step4LocationInfo wires the picker onClear to the wizard persist callback', () => {
  const step4 = wizard.slice(wizard.indexOf('function Step4LocationInfo'), wizard.indexOf('// Step 3: Licensing'))
  assert.match(step4, /function Step4LocationInfo\(\{ form, sectionRef, onClearLocation \}/)
  assert.match(step4, /onClear=\{onClearLocation\}/)
  assert.match(wizard, /onClearLocation=\{persistClearedLocation\}/)
})

test('CLEAR-PERSIST: clearing still uses setValue(undefined) locally (Phase 8.24.3 canonical clear preserved)', () => {
  const clearBlock = wizard.slice(
    wizard.indexOf("form.setValue('officeAddress', '')"),
    wizard.indexOf("form.setValue('location', undefined)") + "form.setValue('location', undefined)".length,
  )
  assert.match(clearBlock, /form\.setValue\('location', undefined\)/)
  assert.doesNotMatch(clearBlock, /resetField/)
})

// ===========================================================================
// REVIEW STEP — reflects canonical saved values, no duplicated city/state
// ===========================================================================

test('REVIEW: the Review step renders location from the canonical derived fields without duplication', () => {
  const review = wizard.slice(wizard.indexOf('function Step6Review'), wizard.indexOf('export default') >= 0 ? wizard.length : wizard.length)
  assert.match(review, /Office Address/)
  assert.match(review, /City \/ State \/ ZIP/)
  // No manual "·" concatenation that produced duplicated city/state text.
  assert.doesNotMatch(review, /value\.normalizedAddress\} · \{value\.city/)
})

// ===========================================================================
// DRAFT SAVE vs FINALIZATION — no double broker/subscription path
// ===========================================================================

test('SAVE-VS-FINALIZE: draft saves reuse the onboarding PATCH and never create a Broker', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  assert.match(handleNext, /fetch\('\/api\/broker-registration\/onboarding'/)
  assert.doesNotMatch(wizard, /broker\.create/)
  assert.doesNotMatch(wizard, /brokerSubscription\.create/)
})