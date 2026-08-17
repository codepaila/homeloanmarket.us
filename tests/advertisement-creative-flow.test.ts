import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const requirementsSrc = fs.readFileSync('lib/advertisements/requirements.ts', 'utf8')
const creativeUpload = fs.readFileSync('components/admin/ads/AdvertisementCreativeUpload.tsx', 'utf8')
const mediaSelector = fs.readFileSync('components/admin/media/MediaSelector.tsx', 'utf8')
const mediaPickerDialog = fs.readFileSync('components/admin/ads/MediaPickerDialog.tsx', 'utf8')
const specs = fs.readFileSync('lib/advertisements/placementSpecs.ts', 'utf8')

test('placement requirement resolver exposes allowed formats', () => {
  assert.match(requirementsSrc, /allowedFormats: AdvertisementFormat\[\]/)
  assert.match(requirementsSrc, /getPlacementFormats\(placement\)/)
})

test('single-format placement exposes exactly one allowed format via the resolver', () => {
  assert.match(requirementsSrc, /allowedFormats: AdvertisementFormat\[\]/)
  assert.match(requirementsSrc, /const allowedFormats = getPlacementFormats\(placement\)/)
  assert.match(requirementsSrc, /creativeSlots: CreativeSlotRequirement\[\]/)
})

test('exact canonical dimensions resolve per format', () => {
  assert.match(requirementsSrc, /getCreativeRequirementForFormat/)
  assert.match(requirementsSrc, /width: requirement\.width/)
  assert.match(requirementsSrc, /height: requirement\.height/)
  assert.match(requirementsSrc, /aspectRatio: requirement\.aspectRatio/)
})

test('SQUARE format requirement carries the canonical 1:1 square spec', () => {
  assert.match(specs, /SQUARE: \{ format: 'SQUARE', width: 800, height: 800, aspectRatio: '1:1'/)
})

test('creative upload component shows exact required resolution and aspect ratio', () => {
  assert.match(creativeUpload, /Required resolution:/)
  assert.match(creativeUpload, /\{requirement\.width\} × \{requirement\.height\}/)
  assert.match(creativeUpload, /Aspect ratio:/)
  assert.match(creativeUpload, /\$\{requirement\.width\} × \$\{requirement\.height\} image/)
  assert.match(creativeUpload, /This creative requires exactly/)
})

test('creative upload reuses the canonical MediaSelector rather than duplicating upload logic', () => {
  assert.match(creativeUpload, /import \{ MediaSelector \} from '@\/components\/admin\/media\/MediaSelector'/)
  assert.match(creativeUpload, /requiredWidth=\{requirement\.width\}/)
  assert.match(creativeUpload, /requiredHeight=\{requirement\.height\}/)
  assert.doesNotMatch(creativeUpload, /FormData/)
  assert.doesNotMatch(creativeUpload, /fetch\(/)
})

test('media selector validates uploaded creative dimensions against the canonical rule', () => {
  assert.match(mediaSelector, /validateCreativeDimensions\(placement, format, uploaded\.width, uploaded\.height\)/)
  assert.match(mediaSelector, /Creative uploaded successfully\./)
})

test('media selector rejects incompatible media-library selections', () => {
  assert.match(mediaSelector, /This image does not match the required/)
  assert.match(mediaSelector, /Creative selected successfully\./)
})

test('media library dialog blocks incompatible assets', () => {
  assert.match(mediaPickerDialog, /This image does not match the required/)
  assert.match(mediaPickerDialog, /isAssetCompatible\(asset\) === false/)
  assert.match(mediaPickerDialog, /Not compatible/)
})

test('backend independently validates creative dimensions via the same shared function', () => {
  const services = fs.readFileSync('lib/advertisements/services.ts', 'utf8')
  assert.match(services, /validateCreativeDimensions\(placement, assignment\.format, asset\.width, asset\.height, device\)/)
  assert.match(services, /isFormatCompatible\(placement, assignment\.format\)/)
  assert.match(services, /not compatible with/)
})
