import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

test('canonical seed is a real writer', () => {
  const source = read('prisma/seed/index.ts')
  assert.ok(source.includes('seedCanonicalData'))
  assert.ok(source.includes('prisma.user'))
  assert.ok(source.includes('prisma.broker'))
})

test('there are no divergent seed command aliases', () => {
  const packageSource = read('package.json')
  assert.ok(packageSource.includes('"seed":'))
  assert.equal(packageSource.includes('seed:production'), false)
  assert.equal(packageSource.includes('seed:demo'), false)
})

test('canonical seed does not hard-code or rewrite database names', () => {
  const source = read('prisma/seed/index.ts')
  assert.ok(source.includes('process.env.DATABASE_URL'))
  assert.equal(source.includes('homeloanmarket_test'), false)
  assert.equal(source.includes('DATABASE_URL.replace'), false)
  assert.ok(source.includes('new URL(rawUrl)'))
})
