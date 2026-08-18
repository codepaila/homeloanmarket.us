import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (p: string) => fs.readFileSync(p, 'utf8')

const schema = read('prisma/schema.prisma')
const brokerBlock = schema.slice(schema.indexOf('model Broker'), schema.indexOf('model BrokerSubscription'))
const route = read('app/api/admin/brokers/[id]/cover-image/route.ts')
const adminActions = read('app/admin/brokers/[id]/AdminBrokerActions.tsx')
const coverComponent = read('components/brokers/CoverImageUpload.tsx')
const coverLib = read('lib/broker-cover-image.ts')
const detail = read('components/sections/broker/BrokerDetailClient.tsx')

test('Broker model already has a canonical coverImage field (reused, no new field)', () => {
  assert.match(brokerBlock, /coverImage\s+String\?/)
  assert.match(brokerBlock, /profileImage\s+String\?/)
  assert.match(brokerBlock, /logo\s+String\?/)
})

test('cover upload reuses the shared server-side image upload pipeline', () => {
  assert.match(coverLib, /uploadBrokerCoverImage/)
  assert.match(coverLib, /uploadImage\(/)
  assert.match(coverLib, /validateImageFile\(/)
  assert.match(coverLib, /COVER_CATEGORY/)
  assert.doesNotMatch(coverLib, /CLOUDINARY_API_SECRET/, 'must not expose the secret in client libs')
})

test('cover route is admin-only and server-authoritative', () => {
  assert.match(route, /export async function POST/)
  assert.match(route, /getCurrentUser\(\)/)
  assert.match(route, /admin\?\.role !== "ADMIN"/)
  assert.match(route, /status: 403/)
  assert.match(route, /Broker not found/)
  assert.match(route, /data: \{ coverImage: url \}/)
  assert.match(route, /export async function DELETE/)
  assert.match(route, /data: \{ coverImage: null \}/)
})

test('cover route keeps the profile image untouched', () => {
  assert.match(route, /profileImage: updated\.profileImage/)
  assert.doesNotMatch(route, /data: \{ profileImage/)
  assert.doesNotMatch(route, /data: \{ logo/)
})

test('cover route returns safe error messages', () => {
  assert.match(route, /CoverImageValidationError/)
  assert.match(route, /Failed to upload cover image/)
  assert.match(route, /No image file provided/)
})

test('admin edit UI includes a dedicated cover image section', () => {
  assert.match(adminActions, /CoverImageUpload/)
  assert.match(adminActions, /\/api\/admin\/brokers\/\$\{broker\.id\}\/cover-image/)
  assert.match(adminActions, /label="Cover image"/)
})

test('cover component supports preview, replace, remove, and loading states', () => {
  assert.match(coverComponent, /Replace cover/)
  assert.match(coverComponent, /Uploading…/)
  assert.match(coverComponent, /Removing…/)
  assert.match(coverComponent, /Remove/)
  assert.match(coverComponent, /disabled=\{busy\}/)
  assert.match(coverComponent, /aspect-\[16\/5\]/)
  assert.match(coverComponent, /object-cover/)
  assert.match(coverComponent, /No cover image/)
})

test('cover component shows recommended dimensions as guidance (not hard rejection)', () => {
  assert.match(coverComponent, /1600 × 500 px \(16:5\)/)
  assert.match(coverComponent, /Optional/)
})

test('public broker detail renders the cover with object-cover and a fallback', () => {
  assert.match(detail, /coverImage \? \(/)
  assert.match(detail, /src=\{coverImage\}/)
  assert.match(detail, /className="object-cover object-center"/)
  assert.match(detail, /sizes="100vw"/)
  assert.match(detail, /bg-muted/)
  // The profile avatar must still use profileImage || logo, never the cover.
  assert.match(detail, /<BrokerAvatar src=\{profileImage \|\| logo\}/)
  assert.doesNotMatch(detail, /<BrokerAvatar src=\{coverImage/)
})
