import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { slugifyBrokerName } from '../lib/broker-registration'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
const setup = read('app/setup/page.tsx')
const onboardingApi = read('app/api/broker-registration/onboarding/route.ts')
const brokerRegLib = read('lib/broker-registration.ts')
const brokersRoute = read('app/api/brokers/route.ts')
const resolveRoute = read('app/api/location/resolve/route.ts')
const googlePlaceLib = read('lib/location/google-place.ts')

// ===========================================================================
// G. LOCATION STEP — validation errors, toasts, and Location -> Review
// ===========================================================================

test('LOCATION: Step 4 validates the Google-resolved location and derived fields', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  assert.match(handleNext, /case 4:\s*isValid = await form\.trigger\(\[\s*'location', 'officeAddress', 'city', 'state', 'pinCode'\]\)/)
  const locationSchemaBlock = wizard.slice(wizard.indexOf('const locationSchema'), wizard.indexOf('const registrationSchema'))
  assert.match(locationSchemaBlock, /placeId: z\.string\(\)/)
  assert.match(locationSchemaBlock, /Boolean\(value\.placeId\)/)
  assert.match(locationSchemaBlock, /Select a validated US office location from the suggestions/)
})

test('LOCATION: no selected location -> error toast and stays on Step 4 (no silent failure)', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const invalidBlock = handleNext.slice(handleNext.indexOf('if (!isValid)'), handleNext.indexOf('if (currentStep < steps.length)'))
  assert.match(invalidBlock, /Please select your office location from the Google suggestions\./)
  assert.doesNotMatch(invalidBlock, /setCurrentStep\(prev => prev \+ 1\)/)
})

test('LOCATION: selected place but missing derived fields -> incomplete-data toast', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const invalidBlock = handleNext.slice(handleNext.indexOf('if (!isValid)'), handleNext.indexOf('if (currentStep < steps.length)'))
  // A place without a ZIP (city-level result) asks for a manual ZIP fallback.
  assert.match(invalidBlock, /Google couldn't detect the ZIP code\. Please enter it to continue\./)
})

test('LOCATION: validation failure scrolls the location section into view', () => {
  const wizardSource = wizard
  assert.match(wizardSource, /locationSectionRef/)
  assert.match(wizardSource, /scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/)
})

test('LOCATION: valid location save succeeds and advances Step 4 -> Step 5', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  // After the is-valid guard, a successful save advances.
  const afterSave = handleNext.slice(handleNext.indexOf('if (currentStep < steps.length)'), handleNext.indexOf('const handleBack'))
  assert.match(afterSave, /setCurrentStep\(prev => prev \+ 1\)/)
  // The advance is gated on a successful (ok) PATCH response.
  assert.match(afterSave, /if \(!response\.ok\) throw new Error/)
})

test('LOCATION: save failure shows a location-specific error toast and stays on Step 4', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  const catchBlock = handleNext.slice(handleNext.indexOf('catch (error)'))
  assert.match(catchBlock, /We couldn't save your location\. Please try again\./)
  assert.doesNotMatch(catchBlock, /setCurrentStep/)
})

test('LOCATION: picker derives officeAddress/city/state/pinCode from the selected place', () => {
  // Google-derived values replace previous ones, preserving any manually
  // entered fallback only when the new result is missing that field.
  assert.match(wizard, /form\.setValue\('officeAddress', location\.normalizedAddress \|\|/)
  assert.match(wizard, /form\.setValue\('city', location\.city \|\|/)
  assert.match(wizard, /form\.setValue\('state', location\.state \|\|/)
  assert.match(wizard, /form\.setValue\('pinCode', location\.zip \|\|/)
  // Clearing uses the canonical form reset (setValue undefined) so no stale
  // location or default-value rehydration can remain.
  assert.match(wizard, /form\.setValue\('location', undefined\)/)
  assert.doesNotMatch(wizard, /form\.resetField\('location'\)/)
})

test('LOCATION: selected place shape matches the finalization contract (placeId + lat/lng + address)', () => {
  // The resolve route returns the canonical ResolvedUSLocation shape used by
  // finalizeBrokerRegistration.
  assert.match(resolveRoute, /resolveUSPlace\(body\.placeId\)/)
  const googleLib = googlePlaceLib
  assert.match(googleLib, /placeId\?: string/)
  assert.match(googleLib, /normalizedAddress: string/)
  assert.match(googleLib, /latitude: number/)
  assert.match(googleLib, /longitude: number/)
  // finalization consumes location.longitude/latitude + normalizedAddress.
  assert.match(brokerRegLib, /coordinates: \[location\.longitude, location\.latitude\]/)
  assert.match(brokerRegLib, /normalizedAddress: location\?\.normalizedAddress/)
})

test('LOCATION: completion never creates a Broker or BrokerSubscription from the step', () => {
  assert.doesNotMatch(wizard, /broker\.create/)
  assert.doesNotMatch(wizard, /brokerSubscription\.create/)
  assert.match(brokersRoute, /createBrokerForExistingUser/)
})

// ===========================================================================
// A. CONTACT STEP — independently saveable and always able to continue
// ===========================================================================

test('CONTACT: step 2 validates ONLY contact fields (phone + optional contact fields)', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('if (isValid && currentStep'))
  assert.match(handleNext, /case 2:\s*isValid = await form\.trigger\(\[\s*'phone', 'whatsapp', 'email', 'website'\]\)/)
})

test('CONTACT: later-step fields (location, nmls, licenseStates, description) never block step 2', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('if (isValid && currentStep'))
  // Step 2 validation must not reference later-step fields.
  const case2Block = handleNext.slice(handleNext.indexOf('case 2:'), handleNext.indexOf('case 3:'))
  assert.doesNotMatch(case2Block, /location/)
  assert.doesNotMatch(case2Block, /nmls/)
  assert.doesNotMatch(case2Block, /licenseStates/)
  assert.doesNotMatch(case2Block, /description/)
})

test('CONTACT: phone is required and validated in the contact schema', () => {
  assert.match(wizard, /phone: z\.string\(\)\.min\(10, 'Phone number must be at least 10 digits'\)/)
})

test('CONTACT: the Google-resolved location is owned by its own Location step, not Contact', () => {
  // The location object with the placeId refine lives in the Location step.
  assert.match(wizard, /Select a validated US office location from the suggestions/)
  const contactSchemaBlock = wizard.slice(wizard.indexOf('const contactInfoSchema'), wizard.indexOf('const professionalSchema'))
  assert.doesNotMatch(contactSchemaBlock, /location/)
  assert.doesNotMatch(contactSchemaBlock, /placeId/)
  const locationSchemaBlock = wizard.slice(wizard.indexOf('const locationSchema'), wizard.indexOf('const registrationSchema'))
  assert.match(locationSchemaBlock, /placeId: z\.string\(\)/)
  assert.match(locationSchemaBlock, /Boolean\(value\.placeId\)/)
})

test('CONTACT: a valid phone plus optional contact fields advances to the next step', () => {
  // handleNext persists the step then advances only after a successful save.
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  assert.match(handleNext, /fetch\('\/api\/broker-registration\/onboarding'/)
  assert.match(handleNext, /if \(!response\.ok\) throw new Error/)
  assert.match(handleNext, /setCurrentStep\(prev => prev \+ 1\)/)
})

test('CONTACT: API failure keeps the user on the current step (no advance on error)', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  assert.match(handleNext, /catch \(error\)/)
  assert.match(handleNext, /toast\.error\(/)
  // setCurrentStep(+1) is only reached after a successful save (inside the try,
  // after the response is ok); the catch block never advances.
  const afterSuccess = handleNext.slice(handleNext.indexOf('if (!response.ok) throw'), handleNext.indexOf('catch (error)'))
  assert.match(afterSuccess, /setCurrentStep\(prev => prev \+ 1\)/)
  const catchBlock = handleNext.slice(handleNext.indexOf('catch (error)'))
  assert.doesNotMatch(catchBlock, /setCurrentStep/)
})

test('CONTACT: double-submit protection guards each step save and shows a Saving state', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('const handleBack'))
  assert.match(handleNext, /if \(savingStep\) return/)
  assert.match(handleNext, /setSavingStep\(true\)/)
  assert.match(handleNext, /finally \{\s*setSavingStep\(false\)/)
  assert.match(wizard, /Saving…/)
  assert.match(wizard, /disabled=\{savingStep\}/)
})

// ===========================================================================
// B. STEP INDEPENDENCE
// ===========================================================================

test('STEPS: professional step validates NMLS and at least one license state', () => {
  assert.match(wizard, /nmls: z\.string\(\)\.trim\(\)\.regex\(\/\^\\d\{4,10\}\$\/, 'NMLS ID must be 4–10 digits'\)/)
  assert.match(wizard, /licenseStates: z\.array\(z\.string\(\)\)\.min\(1, 'Select at least one licensed state'\)/)
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('if (isValid && currentStep'))
  assert.match(handleNext, /case 3:\s*isValid = await form\.trigger\(\[\s*'experienceYears', 'nmls', 'licenseStates'\]\)/)
})

test('STEPS: location step validates the Google place', () => {
  const handleNext = wizard.slice(wizard.indexOf('const handleNext'), wizard.indexOf('if (isValid && currentStep'))
  assert.match(handleNext, /case 4:\s*isValid = await form\.trigger\(\[\s*'location', 'officeAddress', 'city', 'state', 'pinCode'\]\)/)
})

test('STEPS: the wizard has six canonical steps ending in Subscription Plan', () => {
  assert.match(wizard, /{ id: 1, title: 'Basic Profile'/ )
  assert.match(wizard, /{ id: 2, title: 'Contact'/)
  assert.match(wizard, /{ id: 3, title: 'Professional & Licensing'/)
  assert.match(wizard, /{ id: 4, title: 'Location'/)
  assert.match(wizard, /{ id: 5, title: 'Review'/)
  assert.match(wizard, /{ id: 6, title: 'Plan', icon: CreditCard }/)
})

// ===========================================================================
// C. PERSISTENCE / RESUME
// ===========================================================================

test('PERSIST: /setup restores the server draft and the persisted currentStep', () => {
  assert.match(setup, /draft\?\.currentStep/)
  assert.match(setup, /initialData=\{initialData\}/)
  assert.match(setup, /initialStep=\{initialStep\}/)
})

test('PERSIST: the save API persists the canonical draft field set', () => {
  assert.match(onboardingApi, /brokerOnboardingDraft\.upsert/)
  assert.match(onboardingApi, /status: 'ONBOARDING_IN_PROGRESS'/)
})

test('PERSIST: the persisted currentStep is clamped to the five-step wizard', () => {
  assert.match(onboardingApi, /Math\.max\(1, Math\.min\(5, body\.currentStep\)\)/)
})

test('PERSIST: the wizard clamps a stale server step into the canonical range on resume', () => {
  assert.match(wizard, /Math\.min\(Math\.max\(Number\.isInteger\(initialStep\)/)
  assert.match(wizard, /steps\.length/)
})

// ===========================================================================
// D. profileSlug — server-generated, never user input
// ===========================================================================

test('SLUG: the wizard never renders or requires a profileSlug input', () => {
  assert.doesNotMatch(wizard, /profileSlug/)
  assert.doesNotMatch(wizard, /Profile URL Slug/)
})

test('SLUG: the wizard completion payload never sends a slug', () => {
  const submit = wizard.slice(wizard.indexOf('const apiData ='), wizard.indexOf('const response = await fetch'))
  assert.doesNotMatch(submit, /profileSlug|slug/)
})

test('SLUG: finalization always derives the slug server-side from companyName or displayName', () => {
  assert.match(brokerRegLib, /const slugSource = \(typeof merged\.companyName === 'string' && merged\.companyName\.trim\(\)\) \|\| displayName/)
  assert.match(brokerRegLib, /const baseSlug = slugifyBrokerName\(slugSource\)/)
  // A client-supplied slug is never honored.
  assert.doesNotMatch(brokerRegLib, /merged\.profileSlug\.trim\(\) \? slugifyBrokerName\(merged\.profileSlug/)
})

test('SLUG: uniqueness is handled deterministically with a numeric suffix', () => {
  const slugBlock = brokerRegLib.slice(brokerRegLib.indexOf('const baseSlug'), brokerRegLib.indexOf('const dbPlan'))
  assert.match(slugBlock, /while \(await tx\.broker\.findUnique\(\{ where: \{ profileSlug \} \}\)\)/)
  assert.match(slugBlock, /profileSlug = `\$\{slugifyBrokerName\(slugSource\)\}-\$\{suffix\}`/)
})

test('SLUG: slugifyBrokerName normalizes company/profile names', () => {
  assert.equal(slugifyBrokerName('ABC Home Loans'), 'abc-home-loans')
  assert.equal(slugifyBrokerName('ABC Home Loans & Finance'), 'abc-home-loans-finance')
  assert.equal(slugifyBrokerName('  Acme  Mortgage, Inc.  '), 'acme-mortgage-inc')
})

test('SLUG: existing Broker slug is preserved (finalization returns early for an existing broker)', () => {
  assert.match(brokerRegLib, /const existing = await tx\.broker\.findFirst\(\{ where: \{ userId \} \}\)/)
  assert.match(brokerRegLib, /if \(existing\) \{\s*return existing\s*\}/)
})

// ===========================================================================
// E. FINALIZATION
// ===========================================================================

test('FINALIZE: broker creation happens only in finalizeBrokerRegistration (sole path)', () => {
  assert.match(brokerRegLib, /export async function finalizeBrokerRegistration/)
  assert.match(brokersRoute, /createBrokerForExistingUser/)
  assert.match(brokerRegLib, /data: \{ status: 'COMPLETED' \}/)
  // Exactly one BrokerSubscription is created as part of the Broker create.
  assert.match(brokerRegLib, /subscription: \{\s*create: \{/)
  assert.doesNotMatch(brokerRegLib, /brokerSubscription\.create[\s\S]{0,40}subscription: \{\s*create:/)
})

test('FINALIZE: finalization still requires an active registration subscription', () => {
  assert.match(brokerRegLib, /An active broker subscription is required before onboarding/)
  assert.match(brokersRoute, /subscription\?\.status !== 'ACTIVE'/)
})

// ===========================================================================
// F. REGRESSION — subscription lifecycle and isolation preserved
// ===========================================================================

test('REGRESSION: FREE and FEATURED selection endpoints are unchanged', () => {
  const free = read('app/api/broker-registration/subscription/free/route.ts')
  assert.match(free, /plan: 'FREE', status: 'ACTIVE', isActive: true/)
  assert.doesNotMatch(free, /finalizeBrokerRegistration/)
  const checkout = read('app/api/broker-registration/subscription/checkout/route.ts')
  assert.match(checkout, /plan !== 'FEATURED'/)
  assert.match(checkout, /ownerType: 'BROKER_REGISTRATION'/)
})

test('REGRESSION: wizard never touches company models', () => {
  assert.doesNotMatch(wizard, /companyMembership|companySubscription|CompanyAdvertisingPlan/)
  assert.doesNotMatch(brokerRegLib, /companySubscription/)
})