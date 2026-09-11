import { test } from 'node:test'
import assert from 'node:assert/strict'

// Canonical ADMIN_EMAILS parsing (lib/platform-config.ts). Mock-free so the
// REAL module is loaded; matches the target semantics for Phase 9.2:
//  - comma-separated, trimmed, lowercased
//  - invalid addresses filtered with the platform email regex
//  - deduplicated (case-insensitive)
//  - legacy ADMIN_EMAIL fallback retained
//  - empty/whitespace -> [] (nothing breaks downstream; notifications skip)

// types/environment.d.ts types ADMIN_EMAIL* as non-optional string, so env
// mutations are done through a string|undefined-cast view of process.env.
function setEnvVar(key: 'ADMIN_EMAILS' | 'ADMIN_EMAIL', value: string | undefined): void {
  const env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
  if (value === undefined) {
    delete env[key]
  } else {
    env[key] = value
  }
}

let parseAdminEmails: () => string[]

test('load the real platform-config module (mock-free)', async () => {
  parseAdminEmails = (await import('../lib/platform-config')).parseAdminEmails
  assert.equal(typeof parseAdminEmails, 'function')
})

test('MATRIX 14: ADMIN_EMAILS resolves two distinct admin recipients', () => {
  setEnvVar('ADMIN_EMAILS', 'admin1@example.com,admin2@example.com')
  setEnvVar('ADMIN_EMAIL', undefined)
  assert.deepEqual(parseAdminEmails(), ['admin1@example.com', 'admin2@example.com'])
})

test('MATRIX 17: empty ADMIN_EMAILS resolves to no admin recipients', () => {
  setEnvVar('ADMIN_EMAILS', '')
  setEnvVar('ADMIN_EMAIL', undefined)
  assert.deepEqual(parseAdminEmails(), [])
})

test('whitespace-only ADMIN_EMAILS resolves to no admin recipients', () => {
  setEnvVar('ADMIN_EMAILS', '   ,  , ')
  setEnvVar('ADMIN_EMAIL', undefined)
  assert.deepEqual(parseAdminEmails(), [])
})

test('ADMIN_EMAILS parsing trims, lowercases, filters invalid addresses, and dedupes', () => {
  setEnvVar('ADMIN_EMAILS', '  Admin1@Example.com , bad-address, ,admin@example.com  ')
  setEnvVar('ADMIN_EMAIL', undefined)
  assert.deepEqual(parseAdminEmails(), ['admin1@example.com', 'admin@example.com'])
})

test('legacy ADMIN_EMAIL fallback is preserved when ADMIN_EMAILS is missing', () => {
  setEnvVar('ADMIN_EMAILS', undefined)
  setEnvVar('ADMIN_EMAIL', 'legacy@example.com')
  assert.deepEqual(parseAdminEmails(), ['legacy@example.com'])
})

test('legacy ADMIN_EMAIL invalid value resolves to no admin recipients', () => {
  setEnvVar('ADMIN_EMAILS', undefined)
  setEnvVar('ADMIN_EMAIL', 'not-an-email')
  assert.deepEqual(parseAdminEmails(), [])
})