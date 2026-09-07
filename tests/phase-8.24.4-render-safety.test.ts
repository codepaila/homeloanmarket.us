import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const picker = read('components/location/USLocationPicker.tsx')
const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')

// ===========================================================================
// PHASE 8.24.4 — USLocationPicker must never re-render indefinitely
// ===========================================================================

test('RENDER-SAFETY: the picker performs NO value->input setState during render', () => {
  // The bug: `if (value?.normalizedAddress !== lastValueAddress) { setLast... }`
  // executed setState directly during render. With value === undefined the
  // comparison `undefined !== ''` never converges, so every render scheduled
  // another render -> "Too many re-renders". No such block exists anymore.
  assert.doesNotMatch(picker, /lastValueAddress/)
  assert.doesNotMatch(picker, /if \(value\?\.normalizedAddress !==/)
  assert.doesNotMatch(picker, /setInput\(value\?\.normalizedAddress \|\| ''\)/)
})

test('RENDER-SAFETY: the input is seeded once from value, not synchronized from it', () => {
  // The search input is transient UI state initialized from the canonical value
  // (draft resume) and updated only by user actions. An effect that copies
  // `value` back into the input would erase the user's typing, because typing
  // calls onChange(undefined) (which sets value to undefined) to keep typed-but-
  // unselected text invalid.
  assert.match(picker, /useState\(value\?\.normalizedAddress \|\| ''\)/)
  assert.doesNotMatch(picker, /setInput\(\(current\) =>/)
  assert.doesNotMatch(picker, /const nextAddress = value\?\.normalizedAddress \?\? ''/)
})

test('RENDER-SAFETY: no setState in an effect body (lint react-hooks/set-state-in-effect)', () => {
  // The only effect (autocomplete) schedules setSuggestions inside async
  // callbacks/timeouts — never synchronously in the effect body.
  const autocompleteEffect = picker.slice(picker.indexOf('useEffect(() => {'), picker.indexOf('async function select'))
  assert.match(autocompleteEffect, /window\.setTimeout\(\(\) => setSuggestions\(\[\]\), 0\)/)
  assert.doesNotMatch(autocompleteEffect, /setInput\(/)
})

// ===========================================================================
// CONTRACT PRESERVED
// ===========================================================================

test('CONTRACT: renders with undefined value (fresh setup) without a confirmation panel', () => {
  // value === undefined -> no placeId -> panel gated off; empty-state shows.
  assert.match(picker, /\{value && value\.placeId \?/)
  assert.match(picker, /Select a Google-resolved US place to save canonical coordinates\./)
})

test('CONTRACT: a valid selected location (with placeId) renders a single confirmation panel', () => {
  assert.match(picker, /formatSelectedLocation\(value\)/)
  assert.match(picker, /\{value && value\.placeId \?/)
})

test('CONTRACT: clear calls onChange(undefined) and empties input/suggestions/error', () => {
  const clearFn = picker.slice(picker.indexOf('function clear()'), picker.indexOf('\n  return ('))
  assert.match(clearFn, /setInput\(''\)/)
  assert.match(clearFn, /setSuggestions\(\[\]\)/)
  assert.match(clearFn, /setError\(''\)/)
  assert.match(clearFn, /onChange\(undefined\)/)
})

test('CONTRACT: wizard clears the canonical location with setValue(undefined) (Phase 8.24.3 preserved)', () => {
  const clearBlock = wizard.slice(
    wizard.indexOf("form.setValue('officeAddress', '')"),
    wizard.indexOf("form.setValue('location', undefined)") + "form.setValue('location', undefined)".length,
  )
  assert.match(clearBlock, /form\.setValue\('location', undefined\)/)
  assert.doesNotMatch(clearBlock, /resetField/)
})

test('CONTRACT: select resolves a place and derives fields via onChange (no render-body mutation)', () => {
  const selectFn = picker.slice(picker.indexOf('async function select'), picker.indexOf('\n  function clear'))
  assert.match(selectFn, /setSuggestions\(\[\]\)/)
  assert.match(selectFn, /onChange\(resolved\)/)
})

test('CONTRACT: no duplicate selected-location state system exists', () => {
  assert.doesNotMatch(picker, /lastValueAddress/)
  assert.doesNotMatch(picker, /selectedPlace|selectedLocation\s*=\s*useState/)
  // Only transient UI state is held locally.
  const stateNames = ['input', 'suggestions', 'error']
  for (const name of stateNames) {
    assert.match(picker, new RegExp(`\\[${name}, set${name[0].toUpperCase()}${name.slice(1)}\\]`))
  }
  assert.match(picker, /value\?: SelectedUSLocation/)
  assert.match(picker, /onChange: \(location\?: SelectedUSLocation\) => void/)
})

test('CONTRACT: Daytona/locality without ZIP remains rejected (manual-ZIP fallback message)', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const invalidBlock = handleNext.slice(handleNext.indexOf('if (!isValid)'), handleNext.indexOf('if (currentStep < steps.length)'))
  assert.match(invalidBlock, /!zip/)
  assert.match(invalidBlock, /Google couldn't detect the ZIP code\. Please enter it to continue\./)
})