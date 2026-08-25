import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (relative: string): string => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8')

// ===========================================================================
// Bank Partner is NOT required in broker onboarding
// ===========================================================================

test('broker onboarding wizard no longer displays a Bank Partnership step/section', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.doesNotMatch(wizard, /Bank Partnerships/, 'wizard must not render a Bank Partnerships section')
  assert.doesNotMatch(wizard, /bankPartnerships/, 'wizard form must not collect bank partnerships')
  assert.doesNotMatch(wizard, /bankOptions/, 'wizard must not offer a bank selector')
  assert.doesNotMatch(wizard, /handleAddItem/, 'wizard must not manage bank partnership chips')
})

test('wizard completion payload no longer submits bank partnerships', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  const submit = wizard.slice(wizard.indexOf('const apiData ='), wizard.indexOf('const response = await fetch'))
  assert.doesNotMatch(submit, /bankPartnerships/, 'completion payload must not include bankPartnerships')
})

test('broker onboarding does not require a Bank Partner to complete', () => {
  // The completion API only requires displayName/phone/description plus the
  // validated NMLS, license states, and US office location — never a bank.
  const brokerRoute = read('app/api/brokers/route.ts')
  const required = brokerRoute.slice(brokerRoute.indexOf("const requiredFields"), brokerRoute.indexOf('// NMLS + licensed states'))
  for (const field of ['displayName', 'phone', 'description']) {
    assert.match(required, new RegExp(`'${field}'`), `${field} remains required`)
  }
  assert.doesNotMatch(required, /bank/i, 'no bank requirement in completion required fields')
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  const stepValidation = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('if (isValid && currentStep'))
  assert.doesNotMatch(stepValidation, /bank/i, 'no bank validation in the wizard step checks')
})

test('bank partner model and admin/display functionality remain intact', () => {
  const schema = read('prisma/schema.prisma')
  assert.match(schema, /model BrokerBank \{/, 'BrokerBank model preserved for admin/display use')
  assert.match(schema, /brokerId String/, 'BrokerBank still links to a broker')
  // Broker profile display + admin creation still reference bank partnerships.
  const company = read('components/sections/broker/CompanyProfile.tsx')
  assert.match(company, /Bank Partnerships/, 'company profile keeps bank partnership display')
  const registration = read('lib/broker-registration.ts')
  assert.match(registration, /bankPartnerships\?\.length/, 'broker persistence still supports optional bank partnerships')
})

// ===========================================================================
// Existing onboarding requirements are preserved
// ===========================================================================

test('NMLS remains required and validated via the shared licensing helper', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.match(wizard, /nmls: z\.string\(\)\.trim\(\)\.regex\(/, 'wizard NMLS validation preserved')
  assert.match(wizard, /NMLS ID must be 4–10 digits/, 'wizard NMLS format message preserved')
  const brokerRoute = read('app/api/brokers/route.ts')
  assert.match(brokerRoute, /normalizeNmls\(body\.nmls\)/, 'completion validates NMLS server-side')
  assert.match(brokerRoute, /nmlsValidationError\(nmls\)/, 'completion enforces NMLS format')
})

test('License States remain required with at least one US state', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.match(wizard, /licenseStates: z\.array\(z\.string\(\)\)\.min\(1, 'Select at least one licensed state'\)/, 'at least one license state required')
  assert.match(wizard, /US_STATES/, 'wizard uses the shared US state list')
  const brokerRoute = read('app/api/brokers/route.ts')
  assert.match(brokerRoute, /validateLicenseStates\(body\.licenseStates\)/, 'completion validates license states')
})

test('Google-resolved US office location remains required', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.match(wizard, /Select a validated US office location from the suggestions/, 'wizard requires a validated place')
  assert.match(wizard, /Boolean\(value\.placeId\)/, 'wizard requires a place ID')
  const brokerRoute = read('app/api/brokers/route.ts')
  assert.match(brokerRoute, /resolveUSPlace\(placeId\)/, 'completion re-resolves the place')
  assert.match(brokerRoute, /requireValidResolvedUSLocation\(resolvedLocation\)/, 'completion validates the resolved US location')
})

test('media (logo / profile / cover) behavior is preserved', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.match(wizard, /type="profile"/, 'profile photo upload preserved')
  assert.match(wizard, /type="cover"/, 'cover photo upload preserved')
  assert.match(wizard, /type="logo"/, 'logo upload preserved')
  assert.match(wizard, /profileImage: data\.profileImage/, 'completion payload preserves profileImage')
  assert.match(wizard, /coverImage: data\.coverImage/, 'completion payload preserves coverImage')
})

test('US localization remains intact (no India-specific onboarding fields)', () => {
  const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
  assert.doesNotMatch(wizard, /gstNumber|aadhaarCard|Permanent Account Number|indianCities/, 'no India-era fields')
  assert.match(wizard, /Tax ID \/ EIN|panNumber/, 'US tax identifier label retained')
})