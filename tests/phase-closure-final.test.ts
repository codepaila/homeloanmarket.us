import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

test('closure: media processing imports crypto for generated asset IDs', () => {
  const source = read('lib/advertisements/imageProcessor.ts')
  assert.ok(source.includes('import crypto from "crypto"'))
  assert.ok(source.includes('crypto.randomUUID()'))
})

test('closure: password reset normalizes email before lookup and reset URL', () => {
  const source = read('actions/email.action.ts')
  assert.ok(source.includes("email.trim().toLowerCase()"))
  assert.ok(source.includes('where: { email: normalizedEmail }'))
  assert.ok(source.includes('encodeURIComponent(normalizedEmail)'))
})
