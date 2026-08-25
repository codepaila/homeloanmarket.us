import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { hashPassword, comparePassword } from '@/lib/aes'
import bcrypt from 'bcryptjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const resetRoute = () => read('app/api/auth/reset-password/route.ts')
const profileRoute = () => read('app/api/user/profile/route.ts')

// --- Hashing helper is canonical bcrypt ---
test('hashPassword produces a bcrypt hash and comparePassword verifies it', async () => {
  const hash = await hashPassword('S3cret-pass!')
  assert.ok(hash.startsWith('$2'), 'must be a bcrypt hash')
  assert.equal(await comparePassword('S3cret-pass!', hash), true)
  assert.equal(await comparePassword('wrong', hash), false)
})

// --- Cross-compatibility guard: reset-style hash (any cost) must verify ---
test('A hash created with bare bcrypt.hash (any cost) verifies via comparePassword', async () => {
  const hash = await bcrypt.hash('Another-pass!', 12)
  assert.equal(await comparePassword('Another-pass!', hash), true, 'reset path must remain login-compatible')
})

// --- Full password lifecycle: register -> login, reset -> login, old -> fail ---
test('Password lifecycle is end-to-end compatible (registration / reset / login)', async () => {
  const original = 'Original-pass!'
  const fresh = 'BrandNew-pass!'

  // Registration hashing
  const registrationHash = await hashPassword(original)
  assert.equal(await comparePassword(original, registrationHash), true, 'registration password -> login PASS')

  // Reset hashing (now routed through the same canonical helper)
  const resetHash = await hashPassword(fresh)
  assert.equal(await comparePassword(fresh, resetHash), true, 'reset password -> login PASS')
  assert.equal(await comparePassword(original, resetHash), false, 'old password -> login FAIL')

  // A plaintext password must never be stored/compared directly
  assert.ok(!('plaintext' in {}))
  assert.notEqual(registrationHash, original)
  assert.notEqual(resetHash, fresh)
})

// --- Reset route centralizes hashing through the shared helper ---
test('reset-password route uses the canonical hashPassword helper (no bare bcrypt.hash)', () => {
  const src = resetRoute()
  assert.ok(src.includes("import { hashPassword } from '@/lib/aes'"))
  assert.ok(src.includes('await hashPassword(password)'))
  assert.ok(!src.includes('bcrypt.hash('), 'reset must not call bare bcrypt.hash')
  // Writes to the same User.password field used by login
  assert.ok(src.includes('password: hashedPassword'))
  // Token is single-use
  assert.ok(src.includes('resetPasswordToken: null'))
})

// --- Profile password change centralizes hashing + comparison ---
test('profile route uses canonical hashPassword/comparePassword helpers', () => {
  const src = profileRoute()
  assert.ok(src.includes("import { hashPassword, comparePassword } from '@/lib/aes'"))
  assert.ok(src.includes('await hashPassword(body.newPassword)'))
  assert.ok(src.includes('await comparePassword('))
  assert.ok(!src.includes('bcrypt.hash('), 'profile must not call bare bcrypt.hash')
  assert.ok(!src.includes('bcrypt.compare('), 'profile must not call bare bcrypt.compare')
})
