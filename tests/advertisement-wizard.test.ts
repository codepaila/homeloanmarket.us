import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const wizard = fs.readFileSync('components/admin/ads/AdvertisementWizard.tsx', 'utf8')
const requirements = fs.readFileSync('lib/advertisements/requirements.ts', 'utf8')
const newPage = fs.readFileSync('app/admin/ads/new/page.tsx', 'utf8')

test('wizard shows a step indicator and guided navigation', () => {
  assert.match(wizard, /Step indicator/)
  assert.match(wizard, /Continue to Configuration/)
  assert.match(wizard, /Create Advertisement/)
  assert.match(wizard, /Back/)
})

test('wizard auto-skips the type step when only one valid type exists', () => {
  assert.match(wizard, /validTypes\.length > 1/)
})

test('wizard auto-skips the creative-format step when the placement supports only one format', () => {
  assert.match(wizard, /allowedFormats\.length > 1/)
  assert.match(wizard, /creativeFormat: req\.allowedFormats\.length === 1 \? req\.allowedFormats\[0\] : null/)
})

test('wizard adds a creative-format selection step only when multiple formats are allowed', () => {
  assert.match(wizard, /key: 'format', label: 'Creative Format'/)
  assert.match(wizard, /current\.key === 'format'/)
  assert.match(wizard, /requirements\.allowedFormats\.map/)
})

test('wizard renders only the selected creative slot with exact canonical dimensions', () => {
  assert.match(wizard, /getCreativeRequirementForFormat/)
  assert.match(wizard, /AdvertisementCreativeUpload/)
})

test('wizard builds the canonical advertisement payload', () => {
  assert.match(wizard, /creativeAssignments/)
  assert.match(wizard, /locationTarget/)
  assert.match(wizard, /showMobile/)
  assert.match(wizard, /companyId: effectiveCompanyId \|\| undefined/)
  assert.match(wizard, /requestId: requestContext\?\.requestId/)
})

test('creative upload delegates to the reusable creative upload component for the single slot', () => {
  assert.match(wizard, /AdvertisementCreativeUpload/)
  assert.match(wizard, /requirement=\{formatReq\}/)
  assert.match(wizard, /value=\{state\.creatives\[format\]\}/)
})

test('action / CTA configuration only appears when the action requires it', () => {
  assert.match(wizard, /needsUrl/)
  assert.match(wizard, /needsButton/)
})

test('location targeting is only shown for placements that support it', () => {
  assert.match(wizard, /requirements\?\.supportsLocation/)
  assert.match(wizard, /USLocationPicker/)
})

test('wizard sends the requestId so the server links + fulfills atomically', () => {
  assert.match(wizard, /requestId: requestContext\?\.requestId/)
  assert.match(wizard, /Advertisement created and request fulfilled successfully\./)
})

test('new advertisement page uses the wizard instead of the monolithic form', () => {
  assert.match(newPage, /AdvertisementWizard/)
  assert.doesNotMatch(newPage, /AdvertisementForm/)
})

test('requirements module exposes canonical placement metadata and types', () => {
  assert.match(requirements, /PLACEMENT_META/)
  assert.match(requirements, /getValidTypesForPlacement/)
  assert.match(requirements, /ACTION_META/)
  assert.match(requirements, /CreativeSlotRequirement/)
  assert.match(requirements, /AdvertisementRequirements/)
  assert.match(requirements, /getCreativeRequirementForFormat/)
})

test('wizard prevents submission while running and toasts success/error', () => {
  assert.match(wizard, /setSubmitting\(true\)/)
  assert.match(wizard, /toast\.success\(requestContext \? 'Advertisement created and request fulfilled successfully\.' : 'Advertisement created successfully\.'\)/)
  assert.match(wizard, /toast\.error\(/)
})
