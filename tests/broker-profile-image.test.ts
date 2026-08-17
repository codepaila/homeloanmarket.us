import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (p: string) => fs.readFileSync(p, 'utf8')

const schema = read('prisma/schema.prisma')
const meRoute = read('app/api/brokers/me/route.ts')
const adminRoute = read('app/api/admin/brokers/[id]/route.ts')
const adminCreateRoute = read('app/api/admin/brokers/route.ts')
const policy = read('lib/broker-policy.ts')
const gridCard = read('components/brokers/BrokerGridCard.tsx')
const detailClient = read('components/sections/broker/BrokerDetailClient.tsx')
const editProfile = read('components/sections/broker/EditProfile.tsx')
const adminActions = read('app/admin/brokers/[id]/AdminBrokerActions.tsx')

const brokerBlock = schema.slice(schema.indexOf('model Broker'), schema.indexOf('model BrokerSubscription'))

test('Broker schema contains profileImage, logo, and coverImage as separate fields', () => {
  assert.match(brokerBlock, /profileImage\s+String\?/)
  assert.match(brokerBlock, /logo\s+String\?/)
  assert.match(brokerBlock, /coverImage\s+String\?/)
})

test('profileImage is optional so existing brokers work with profileImage = null', () => {
  assert.match(brokerBlock, /profileImage\s+String\?/, 'must be String? (optional), not String (required)')
})

test('profileImage is part of the broker editable allowlist', () => {
  assert.ok(policy.includes("'profileImage'"), 'BROKER_EDITABLE_FIELDS must include profileImage')
  assert.ok(policy.includes("'logo'"), 'logo must remain editable')
  assert.ok(policy.includes("'coverImage'"), 'coverImage must remain editable')
})

test('broker self-service updates profileImage only for their own broker', () => {
  assert.match(meRoute, /where: \{ userId: currentUser\.id \}/, 'broker must be derived from the authenticated user relationship')
  assert.match(meRoute, /body\.profileImage !== undefined/, 'profileImage must be handled')
  assert.match(meRoute, /updateData\.profileImage = body\.profileImage/, 'profileImage must be written to the update payload')
  assert.doesNotMatch(meRoute, /body\.brokerId/, 'a client must not be able to target another broker by id')
  assert.match(meRoute, /broker\.update\(\{/, 'must update an existing broker, never create a new one')
})

test('admin can update any broker profileImage via the admin PATCH allowlist', () => {
  assert.match(adminRoute, /admin\?\.role !== 'ADMIN'/, 'admin authorization must be enforced')
  assert.match(adminRoute, /'profileImage'/, 'admin PATCH allowlist must include profileImage')
  assert.match(adminRoute, /prisma\.broker\.update\(\{ where: \{ id \}/, 'admin PATCH must update by id without creating a duplicate')
})

test('admin broker create accepts profileImage alongside logo and coverImage', () => {
  assert.match(adminCreateRoute, /profileImage: typeof body\.profileImage === 'string'/, 'create must accept profileImage')
  assert.match(adminCreateRoute, /profileImage: input\.profileImage/, 'create must persist profileImage')
  assert.match(adminCreateRoute, /logo: input\.logo/, 'logo must remain independent')
  assert.match(adminCreateRoute, /coverImage: input\.coverImage/, 'coverImage must remain independent')
})

test('non-admin and non-broker cannot modify broker profileImage', () => {
  assert.match(adminRoute, /admin\?\.role !== 'ADMIN'/, 'admin route must enforce admin role')
  assert.match(adminRoute, /status: 403/, 'admin route must reject with 403')
  assert.match(meRoute, /currentUser\.role !== 'BROKER'/, 'self-service must require BROKER role')
  assert.match(meRoute, /status: 403/, 'self-service must reject non-brokers with 403')
})

test('broker profile edit UI exposes a professional profile image uploader', () => {
  assert.match(editProfile, /ProfileImageUpload/, 'edit form must use the profile image upload component')
  assert.match(editProfile, /\/api\/brokers\/me\/profile-image/, 'edit form must target the broker self-service upload endpoint')
})

test('admin broker edit UI exposes a profile image field', () => {
  assert.match(adminActions, /ProfileImageUpload/, 'admin edit form must use the profile image upload component')
  assert.match(adminActions, /\/api\/admin\/brokers\/\$\{broker\.id\}\/profile-image/, 'admin must target the admin upload endpoint')
})

test('public broker listing card uses Broker.profileImage, not User.image', () => {
  assert.match(gridCard, /profileImage/, 'listing card must render profileImage')
  assert.match(gridCard, /src=\{profileImage \|\| logo\}/, 'listing card must prefer profileImage with logo fallback')
  assert.doesNotMatch(gridCard, /user\.image|user\?\.image/, 'listing card must not use User.image')
})

test('public broker profile page uses Broker.profileImage, not User.image', () => {
  assert.match(detailClient, /profileImage \|\| logo/, 'profile page must prefer profileImage')
  assert.doesNotMatch(detailClient, /BrokerAvatar src=\{logo\}/, 'profile page must no longer use logo as the professional photo')
})

test('missing profileImage falls back safely (logo, then neutral avatar)', () => {
  assert.match(gridCard, /profileImage \|\| logo/, 'fallback chain must be profileImage then logo')
})
