import assert from 'node:assert/strict'
import test from 'node:test'
import { AdvertisementPlacement } from '@prisma/client'
import { assertDemoDatabase, DEMO_SEED_DATE } from '../prisma/seed/helpers'

function withDatabaseUrl(value: string | undefined, callback: () => void) {
  const previous = process.env.DATABASE_URL
  if (value === undefined) Reflect.deleteProperty(process.env, 'DATABASE_URL')
  else process.env.DATABASE_URL = value
  try {
    callback()
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, 'DATABASE_URL')
    else process.env.DATABASE_URL = previous
  }
}

test('seed refuses non-local or non-demo databases', () => {
  withDatabaseUrl('mongodb://prod.example.test:27017/application', () => {
    assert.throws(() => assertDemoDatabase(), /Refusing to seed/)
  })
})

test('seed accepts only an isolated local demo database', () => {
  withDatabaseUrl('mongodb://localhost:27017/homeloanmarket-phase13-1', () => {
    assert.doesNotThrow(() => assertDemoDatabase())
  })
})

test('seed reference time is deterministic', () => {
  assert.equal(DEMO_SEED_DATE.toISOString(), '2026-01-15T12:00:00.000Z')
})

test('seed placement contract covers the certified 16 placements', () => {
  assert.equal(Object.values(AdvertisementPlacement).length, 16)
})
