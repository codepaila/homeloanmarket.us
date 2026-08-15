import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync('scripts/ensure-ownership-index.ts', 'utf8')

test('ownership reconciliation targets only the Broker userId index', () => {
  assert.match(source, /key\.userId === 1/)
  assert.match(source, /partialFilterExpression: \{ userId: \{ \$type: 'objectId' \} \}/)
  assert.match(source, /brokers_userId_non_null_unique/)
  assert.doesNotMatch(source, /dropDatabase|deleteMany|brokers\.deleteMany/)
})

test('ownership reconciliation aborts before index changes on duplicate non-null owners', () => {
  const duplicateCheck = source.indexOf('Duplicate ownership detected')
  const indexChanges = source.indexOf('brokers.createIndex')
  assert.ok(duplicateCheck >= 0)
  assert.ok(indexChanges > duplicateCheck)
  assert.match(source, /EJSON\.stringify\(duplicates\)/)
})

test('healthy ownership index is reported without changes', () => {
  assert.match(source, /status: changed \? 'reconciled' : 'healthy'/)
  assert.match(source, /changed: Boolean\(changed\)/)
})
