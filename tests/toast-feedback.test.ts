import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (p: string) => fs.readFileSync(p, 'utf8')

const adminBrokerActions = read('app/admin/brokers/[id]/AdminBrokerActions.tsx')
const adminBrokerForm = read('app/admin/brokers/create/AdminBrokerForm.tsx')
const profileImageUpload = read('components/brokers/ProfileImageUpload.tsx')
const imageUpload = read('components/ImageUpload.tsx')
const companyProfile = read('components/sections/broker/CompanyProfile.tsx')
const companyDashboard = read('app/company/dashboard/CompanyDashboardClient.tsx')
const companyOnboarding = read('app/company/onboarding/page.tsx')
const adminMedia = read('app/admin/media/page.tsx')
const footer = read('components/layout/Footer.tsx')

function slice(fnName: string, source: string): string {
  const start = source.indexOf(fnName)
  const end = source.indexOf('\n  }', start)
  return source.slice(start, end === -1 ? source.length : end)
}

test('admin broker profile update shows a success toast only after the API succeeds', () => {
  const fn = slice('async function updateProfile', adminBrokerActions)
  assert.match(fn, /toast\.success\('Broker profile updated successfully\.'\)/, 'success toast must exist')
  assert.match(fn, /if \(!response\.ok\) throw new Error/, 'error must be thrown on non-2xx before success')
  assert.ok(fn.indexOf('if (!response.ok)') < fn.indexOf("toast.success('Broker profile updated successfully.')"), 'success toast must come after the response check')
  assert.match(fn, /toast\.error\(/, 'error toast must exist')
})

test('admin broker profile update prevents duplicate submission and does not show success before completion', () => {
  const fn = slice('async function updateProfile', adminBrokerActions)
  assert.match(fn, /if \(saving\) return/, 'duplicate submit must be prevented')
  assert.match(fn, /router\.refresh\(\)/, 'data must be revalidated after success')
})

test('admin broker location resolve shows toast success/error', () => {
  const fn = slice('async function resolveLocation', adminBrokerActions)
  assert.match(fn, /toast\.success\('Location resolved and saved\.'\)/, 'location success toast must exist')
  assert.match(fn, /toast\.error\(/, 'location error toast must exist')
})

test('admin broker create shows success/error toast based on the response', () => {
  const fn = slice('async function submit', adminBrokerForm)
  assert.match(fn, /if \(!response\.ok\) throw new Error/, 'error must be thrown on non-2xx')
  assert.match(fn, /toast\.success\('Broker created successfully\.'\)/, 'create success toast must exist')
  assert.match(fn, /toast\.error\(message\)/, 'create error toast must exist')
})

test('profile image upload/remove shows success and error toasts', () => {
  assert.match(profileImageUpload, /toast\.success\('Profile image updated successfully\.'\)/, 'upload success toast')
  assert.match(profileImageUpload, /toast\.success\('Profile image removed successfully\.'\)/, 'remove success toast')
  assert.match(profileImageUpload, /toast\.error\(message\)/, 'error toast')
  assert.match(profileImageUpload, /Unable to upload profile image\. Please try again\./, 'upload error fallback')
  assert.match(profileImageUpload, /Unable to remove profile image\. Please try again\./, 'remove error fallback')
})

test('generic image upload shows success and error toasts based on server completion', () => {
  const fn = slice('const handleFileChange', imageUpload)
  assert.match(fn, /if \(!response\.ok\) throw new Error/, 'error must be thrown on non-2xx')
  assert.match(fn, /toast\.success\(/, 'upload success toast must exist')
  assert.match(fn, /toast\.error\(message\)/, 'upload error toast must exist')
})

test('broker company profile keeps success/error toasts for logo, cover, and profile updates', () => {
  assert.match(companyProfile, /toast\.success\('Logo uploaded successfully'\)/, 'logo upload success toast')
  assert.match(companyProfile, /toast\.success\('Cover image uploaded successfully'\)/, 'cover upload success toast')
  assert.match(companyProfile, /toast\.success\('Company profile updated successfully!'\)/, 'company profile update success toast')
  assert.match(companyProfile, /\/api\/upload\/image/, 'logo/cover must use the server upload endpoint')
})

test('no success toast is emitted before a response is checked', () => {
  for (const source of [adminBrokerActions, adminBrokerForm, imageUpload, profileImageUpload]) {
    // Every success toast must be gated by a `!response.ok` throw in the same file.
    assert.match(source, /!response\.ok/, 'must check the response before success')
  }
})

test('company dashboard actions show success/error toasts and prevent duplicate submission', () => {
  assert.match(companyDashboard, /toast\.success\('Subscription canceled\.'\)/, 'cancel success toast')
  assert.match(companyDashboard, /toast\.success\('Your advertisement request has been submitted\.'\)/, 'request success toast')
  assert.match(companyDashboard, /toast\.error\(/, 'error toast')
  assert.match(companyDashboard, /if \(busy\) return/, 'duplicate submission guard')
  assert.match(companyDashboard, /router\.refresh\(\)/, 'revalidate data after cancel')
})

test('company onboarding no longer fails silently', () => {
  const fn = slice('async function submit', companyOnboarding)
  assert.match(fn, /toast\.success\('Company onboarding completed\.'\)/, 'onboarding success toast')
  assert.match(fn, /toast\.error\(error instanceof Error/, 'onboarding error toast')
  assert.match(fn, /if \(!response\.ok\) throw new Error/, 'error must be thrown on non-2xx')
})

test('admin media bulk actions await the result and report accurate success/failure', () => {
  assert.match(adminMedia, /Promise\.allSettled/, 'bulk actions must await all requests')
  assert.match(adminMedia, /toast\.success\(/, 'bulk success toast')
  assert.match(adminMedia, /toast\.error\(/, 'bulk error toast')
  assert.match(adminMedia, /\$\{succeeded\} .* \$\{failed\}/, 'bulk messaging must report counts')
  assert.match(adminMedia, /if \(bulkBusy/, 'bulk actions must prevent duplicate submission')
})

test('newsletter subscription shows success/error toast', () => {
  assert.match(footer, /toast\.success\('Subscribed successfully\.'\)/, 'newsletter success toast')
  assert.match(footer, /toast\.error\(message\)/, 'newsletter error toast')
})
