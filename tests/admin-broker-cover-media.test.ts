import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const mediaRoute = read('app/api/admin/brokers/[id]/cover-image/media/route.ts')
const uploadRoute = read('app/api/admin/brokers/[id]/cover-image/route.ts')
const coverUpload = read('components/brokers/CoverImageUpload.tsx')
const adminActions = read('app/admin/brokers/[id]/AdminBrokerActions.tsx')
const schema = read('prisma/schema.prisma')

// ---------------------------------------------------------------------------
// Server: authorization
// ---------------------------------------------------------------------------

test('media cover endpoint is admin-only and rejects non-admin with 403', () => {
  assert.match(mediaRoute, /admin\?\.role !== "ADMIN"/)
  assert.match(mediaRoute, /status: 403/)
})

// ---------------------------------------------------------------------------
// Server: validation
// ---------------------------------------------------------------------------

test('missing broker returns 404', () => {
  assert.match(mediaRoute, /Broker not found/)
  assert.match(mediaRoute, /status: 404/)
})

test('missing or deleted media asset is rejected', () => {
  assert.match(mediaRoute, /asset\.isDeleted/)
  assert.match(mediaRoute, /Media asset not found/)
  assert.match(mediaRoute, /status: 404/)
})

test('non-image media asset is rejected', () => {
  assert.match(mediaRoute, /mimeType\.startsWith\("image\/"\)/)
  assert.match(mediaRoute, /Only image assets can be used as a cover image/)
  assert.match(mediaRoute, /status: 422/)
})

test('media asset without a usable fileUrl is rejected', () => {
  assert.match(mediaRoute, /!asset\.fileUrl/)
  assert.match(mediaRoute, /Media asset has no usable file URL/)
  assert.match(mediaRoute, /status: 422/)
})

// ---------------------------------------------------------------------------
// Server: authoritative URL resolution (no client URL)
// ---------------------------------------------------------------------------

test('server resolves the canonical URL from the DB asset, never the client', () => {
  // The client supplies only mediaAssetId; no coverImage/fileUrl/URL is read from the body.
  assert.match(mediaRoute, /body\?\.mediaAssetId/)
  assert.match(mediaRoute, /const coverImage = asset\.fileUrl/)
  assert.doesNotMatch(mediaRoute, /body\.fileUrl|body\.coverImage|body\.url/)
})

test('client cannot provide an arbitrary external URL', () => {
  assert.doesNotMatch(mediaRoute, /body\.(fileUrl|url|imageUrl|coverImage)/)
})

test('updates only Broker.coverImage', () => {
  // The update payload is exactly { coverImage }; other broker fields are not
  // written. (The `select` clause only returns extra fields for the response.)
  assert.match(mediaRoute, /data: \{ coverImage \}/)
  assert.doesNotMatch(mediaRoute, /data: \{ [^}]*profileImage|data: \{ [^}]*logo|data: \{ [^}]*userId/)
  assert.doesNotMatch(mediaRoute, /data: \{ [^}]*subscription/)
  assert.doesNotMatch(mediaRoute, /mortgageExpertEnabled/)
})

// ---------------------------------------------------------------------------
// Device upload + remove preserved
// ---------------------------------------------------------------------------

test('existing device upload endpoint is preserved unchanged', () => {
  assert.match(uploadRoute, /uploadBrokerCoverImage/)
  assert.match(uploadRoute, /data: \{ coverImage: url \}/)
})

test('remove endpoint is preserved', () => {
  assert.match(uploadRoute, /data: \{ coverImage: null \}/)
})

// ---------------------------------------------------------------------------
// Client: reuse existing MediaPicker, optional integration, no duplicate upload
// ---------------------------------------------------------------------------

test('CoverImageUpload reuses the existing MediaPickerDialog, not a new picker', () => {
  assert.match(coverUpload, /from '@\/components\/admin\/ads\/MediaPickerDialog'/)
  assert.doesNotMatch(coverUpload, /createPortal|new Dialog|new CustomPicker/)
})

test('Choose from Media sends only mediaAssetId, never a URL', () => {
  assert.match(coverUpload, /JSON\.stringify\(\{ mediaAssetId: asset\.id \}\)/)
  assert.doesNotMatch(coverUpload, /mediaAssetId: asset\.fileUrl|fileUrl.*coverImage/)
})

test('CoverImageUpload media integration is optional so other callers are unaffected', () => {
  assert.match(coverUpload, /mediaSelectUrl\?: string/)
  // The media picker is only rendered when mediaSelectUrl is provided (&& guard),
  // so existing callers that omit it are unaffected.
  assert.match(coverUpload, /mediaSelectUrl && \(/)
  assert.match(coverUpload, /<MediaPickerDialog/)
})

test('client prevents duplicate apply requests and shows loading state', () => {
  assert.match(coverUpload, /if \(applyingMedia\) return/)
  assert.match(coverUpload, /Applying…/)
  assert.match(coverUpload, /setApplyingMedia\(true\)/)
})

test('picker closes only after successful application', () => {
  assert.match(coverUpload, /setPickerOpen\(false\)/)
})

test('client does not upload/duplicate the selected media file', () => {
  // The media-apply path never creates FormData or calls uploadUrl.
  assert.match(coverUpload, /mediaSelectUrl/)
  assert.doesNotMatch(coverUpload, /formData.append\('file', asset/)
})

// ---------------------------------------------------------------------------
// Wiring + source indicator
// ---------------------------------------------------------------------------

test('AdminBrokerActions wires the media endpoint and refreshes after apply', () => {
  assert.match(adminActions, /cover-image\/media/)
  assert.match(adminActions, /onUploaded=\{\(\) => router\.refresh\(\)\}/)
})

test('source indicator distinguishes Media Library from upload', () => {
  assert.match(coverUpload, /Selected from Media Library/)
  assert.match(coverUpload, /New upload/)
})

// ---------------------------------------------------------------------------
// Broker.coverImage remains a string/URL field (no schema change)
// ---------------------------------------------------------------------------

test('Broker.coverImage stays a String? field', () => {
  const brokerModel = schema.slice(schema.indexOf('model Broker {'), schema.indexOf('model BrokerSubscription {'))
  assert.match(brokerModel, /coverImage\s+String\?/)
})

test('no new MediaAsset relation was added to Broker', () => {
  const brokerModel = schema.slice(schema.indexOf('model Broker {'), schema.indexOf('model BrokerSubscription {'))
  assert.doesNotMatch(brokerModel, /MediaAsset/)
})

// ---------------------------------------------------------------------------
// No unrelated system modified
// ---------------------------------------------------------------------------

test('media cover flow does not reference subscription, badge, or claim logic', () => {
  assert.doesNotMatch(mediaRoute, /BrokerSubscription|BrokerSubscriptionPlan|PROFILE_BADGE|mortgageExpertEnabled|BrokerClaim/)
  assert.doesNotMatch(coverUpload, /BrokerSubscription|PROFILE_BADGE|mortgageExpertEnabled/)
})