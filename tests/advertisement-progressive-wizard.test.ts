import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const wizard = fs.readFileSync('components/admin/ads/AdvertisementWizard.tsx', 'utf8')

test('duplicate submission is prevented', () => {
  assert.match(wizard, /if \(submitting\) return/)
  assert.match(wizard, /setSubmitting\(true\)/)
  assert.match(wizard, /disabled=\{submitting\}/)
})

test('creating state disables the create button', () => {
  assert.match(wizard, /submitting \? 'Creating…' : 'Create Advertisement'/)
})

test('CTA fields render only when the selected action requires them', () => {
  assert.match(wizard, /current\.key === 'action' &&/)
  assert.match(wizard, /needsUrl && \(/)
  assert.match(wizard, /needsButton && \(/)
})

test('location targeting renders only when the placement requires it', () => {
  assert.match(wizard, /current\.key === 'targeting' && requirements\?\.supportsLocation/)
})

test('device targeting renders only when the placement supports mobile', () => {
  assert.match(wizard, /requirements\?\.supportsMobile && \(/)
})

test('type step shows only valid types and is skipped when a single type is valid', () => {
  assert.match(wizard, /validTypes\.length > 1/)
  assert.match(wizard, /validTypes\.map\(/)
})

test('review exposes required and uploaded creative resolution', () => {
  assert.match(wizard, /Required resolution/)
  assert.match(wizard, /Uploaded resolution/)
  assert.match(wizard, /formatReq\.width\} × \{formatReq\.height\} px/)
})

test('review shows owner and request linkage when present', () => {
  assert.match(wizard, /\(requestContext \|\| state\.owner\.type === 'COMPANY'\) &&/)
  assert.match(wizard, /REQUEST-\{requestContext\.requestId\.slice\(-8\)\.toUpperCase\(\)\}/)
  assert.match(wizard, /Platform \/ No Company/)
})

test('step indicator exposes the current step to assistive technology', () => {
  assert.match(wizard, /aria-current=\{index === step \? 'step' : undefined\}/)
  assert.match(wizard, /aria-label="Advertisement creation steps"/)
})
