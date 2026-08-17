import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const form = fs.readFileSync('components/admin/ads/AdvertisementForm.tsx', 'utf8')

test('existing advertisement creatives are loaded into assignments', () => {
  assert.match(form, /ad\?\.creatives\?\.length/)
  assert.match(form, /ad\.creatives\.map\(\(creative\) => \(\{ mediaAssetId: creative\.mediaAssetId, format: creative\.format, asset: creative\.mediaAsset \|\| undefined \}\)/)
})

test('legacy desktop/mobile media is mapped into a supported format on load', () => {
  assert.match(form, /const placementFormats = getPlacementFormats\(ad\?\.placement \|\| ''\)/)
  assert.match(form, /const primaryFormat = placementFormats\[0\]/)
  assert.match(form, /supportsMobile = placementFormats\.includes\('MOBILE'\)/)
})

test('single-format placement auto-selects its format for the editor', () => {
  assert.match(form, /if \(placementFormats\.length === 1\) return placementFormats\[0\]/)
  assert.match(form, /setSelectedCreativeFormat\(\(current\) =>/)
  assert.match(form, /current && placementFormats\.includes\(current\) \? current : placementFormats\[0\] \|\| null/)
})

test('multi-format placement shows a format picker with exact resolutions', () => {
  assert.match(form, /allowedFormats\.length > 1 \?/)
  assert.match(form, /aria-pressed=\{isSelected\}/)
  assert.match(form, /getCreativeRequirementForFormat\(watchPlacement, format\)/)
  assert.match(form, /\{req\.width\} × \{req\.height\} px/)
  assert.match(form, /Aspect ratio: \{req\.aspectRatio\}/)
})

test('only the selected creative slot is rendered', () => {
  assert.match(form, /const selectedFormat = selectedCreativeFormat && allowedFormats\.includes\(selectedCreativeFormat\) \? selectedCreativeFormat : allowedFormats\[0\] \|\| null/)
  assert.match(form, /const formatReq = getCreativeRequirementForFormat\(watchPlacement, selectedFormat\)/)
  assert.doesNotMatch(form, /availableCreativeFormats\.map\(\(format\)/)
})

test('exact required resolution is shown in the creative editor', () => {
  assert.match(form, /Required resolution: \{formatReq\.width\} × \{formatReq\.height\} px · \{formatReq\.aspectRatio\}/)
  assert.match(form, /requiredWidth=\{formatReq\.width\}/)
  assert.match(form, /requiredHeight=\{formatReq\.height\}/)
})

test('assigned creatives summary preserves all assignments and flags mismatches', () => {
  assert.match(form, /Assigned Creatives/)
  assert.match(form, /creativeAssignments\.map\(\(assignment\) =>/)
  assert.match(form, /isFormatCompatible\(watchPlacement \|\| '', assignment\.format\)/)
  assert.match(form, /asset\.width === required\.width && asset\.height === required\.height/)
  assert.match(form, /Not supported for placement/)
})

test('replacing a creative only touches its own format', () => {
  assert.match(form, /const next = current\.filter\(\(assignment\) => assignment\.format !== format\)/)
  assert.match(form, /if \(asset\) next\.push\(\{ mediaAssetId: asset\.id, format, asset \}\)/)
})

test('save preserves all assigned creatives and blocks duplicate submission', () => {
  assert.match(form, /const assignments = creativeAssignments\.filter\(\(assignment\) => isFormatCompatible\(watchPlacement \|\| '', assignment\.format\)\)/)
  assert.match(form, /setIsSubmitting\(true\)/)
  assert.match(form, /disabled=\{isSubmitting \|\| sessionStatus === 'loading'\}/)
  assert.match(form, /isSubmitting \? .*Saving\.\.\../)
})

test('success toast only after a successful API response, single error toast otherwise', () => {
  assert.match(form, /if \(!response\.ok\) throw new Error\(result\.error \|\| `Failed to \$\{isEditMode \? 'update' : 'create'\} advertisement`\)/)
  assert.match(form, /toast\.success\(`Advertisement \$\{isEditMode \? 'updated' : 'created'\} successfully`\)/)
  assert.match(form, /toast\.error\(error instanceof Error \? error\.message : 'Submission failed'\)/)
})

test('company and request linkage are preserved on edit', () => {
  assert.match(form, /companyId: ad\?\.companyId \|\| companyId/)
  assert.match(form, /locationTarget: ad\?\.locationTarget \|\| initialLocationTarget/)
})

test('only valid advertisement types are shown for the placement', () => {
  assert.match(form, /getValidTypesForPlacement\(watchPlacement \|\| ''\)\.map\(\(type\) =>/)
  assert.match(form, /AD_TYPE_LABELS\[type\]/)
  assert.doesNotMatch(form, /AD_TYPE_OPTIONS/)
})

test('BROKER_LISTING_LOCAL location targeting is only shown where applicable', () => {
  assert.match(form, /watchPlacement === 'BROKER_LISTING_LOCAL' &&/)
  assert.match(form, /USLocationPicker/)
})

test('summary reflects the current form state', () => {
  assert.match(form, /<CardTitle className="text-base font-semibold">Summary<\/CardTitle>/)
  assert.match(form, /Required resolution/)
  assert.match(form, /Uploaded resolution/)
  assert.match(form, /Radius/)
  assert.match(form, /AD_TYPE_LABELS\[watchType as AdType\]/)
})

test('no duplicate action-type UI', () => {
  assert.match(form, /ACTION_OPTIONS\.map\(\(option\) =>/)
  const matches = form.match(/Action Type/g) || []
  assert.equal(matches.length, 1)
})
