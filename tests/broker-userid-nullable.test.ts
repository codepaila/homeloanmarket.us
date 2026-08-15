import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')
const ownershipScript = fs.readFileSync('scripts/ensure-ownership-index.ts', 'utf8')
const locationScript = fs.readFileSync('scripts/ensure-broker-location-index.ts', 'utf8')

test('Broker.userId is nullable and no longer uses a Prisma @unique constraint', () => {
  const brokerBlock = schema.slice(schema.indexOf('model Broker'), schema.indexOf('model BrokerSubscription'))
  assert.match(brokerBlock, /userId\s+String\?\s+@db\.ObjectId/)
  assert.doesNotMatch(brokerBlock, /userId\s+String\?\s+@unique/)
})

test('User.brokerProfile is a one-to-many relation so nullable userId needs no unique index', () => {
  const userBlock = schema.slice(schema.indexOf('model User'), schema.indexOf('model Broker'))
  assert.match(userBlock, /brokerProfile\s+Broker\[\]/)
})

test('ownership reconciliation creates a partial unique index for non-null userId only', () => {
  assert.match(ownershipScript, /brokers_userId_non_null_unique/)
  assert.match(ownershipScript, /partialFilterExpression: \{ userId: \{ \$type: 'objectId' \} \}/)
  assert.match(ownershipScript, /unique: true/)
})

test('ownership reconciliation never touches the location 2dsphere index', () => {
  assert.doesNotMatch(ownershipScript, /2dsphere/)
  assert.doesNotMatch(ownershipScript, /brokers_location_2dsphere/)
})

test('location index script preserves the 2dsphere index on location', () => {
  assert.match(locationScript, /location: '2dsphere'/)
  assert.match(locationScript, /brokers_location_2dsphere/)
})

test('broker ownership lookups use findFirst rather than a unique userId lookup', () => {
  const claimCompletion = fs.readFileSync('lib/claim-completion.ts', 'utf8')
  const brokerRegistration = fs.readFileSync('lib/broker-registration.ts', 'utf8')
  const brokerIntent = fs.readFileSync('lib/broker-intent.ts', 'utf8')
  const meRoute = fs.readFileSync('app/api/brokers/me/route.ts', 'utf8')
  assert.match(claimCompletion, /broker\.findFirst\(\{ where: \{ userId \}/)
  assert.match(brokerRegistration, /broker\.findFirst\(\{ where: \{ userId \}/)
  assert.match(brokerIntent, /broker\.findFirst\(\{ where: \{ userId \}/)
  assert.match(meRoute, /broker\.findFirst\(\{\n?\s*where: \{ userId: currentUser\.id \}/)
})
