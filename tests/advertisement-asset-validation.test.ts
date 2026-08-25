import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAssetFormat } from '../lib/advertisements/assetFormat'
import { validateAsset } from '../lib/advertisements/assetValidation'
import { buildCopyTitle, stripCopySuffix } from '../lib/advertisements/duplicateTitle'

// ---------------------------------------------------------------------------
// Canonical asset format resolution
// ---------------------------------------------------------------------------

test('resolveAssetFormat: full MediaAsset with fileName resolves from fileName', () => {
  const resolved = resolveAssetFormat({
    fileName: 'banner-2025-01.webp',
    originalName: 'summer.png',
    mimeType: 'image/png',
    fileUrl: '/uploads/media/banner.webp',
  })
  assert.equal(resolved.format, 'webp')
  assert.equal(resolved.source, 'fileName')
})

test('resolveAssetFormat: explicit extension wins over fileName', () => {
  const resolved = resolveAssetFormat({ extension: 'jpg', fileName: 'a.png' })
  assert.equal(resolved.format, 'jpg')
  assert.equal(resolved.source, 'extension')
})

test('resolveAssetFormat: missing fileName falls back to originalName', () => {
  const resolved = resolveAssetFormat({ originalName: 'creative.JPEG' })
  assert.equal(resolved.format, 'jpeg')
  assert.equal(resolved.source, 'originalName')
})

test('resolveAssetFormat: MIME type is used when no filename exists', () => {
  const resolved = resolveAssetFormat({ mimeType: 'image/webp' })
  assert.equal(resolved.format, 'webp')
  assert.equal(resolved.source, 'mimeType')
})

test('resolveAssetFormat: URL-only assets derive the format from the fileUrl basename', () => {
  const resolved = resolveAssetFormat({ fileUrl: '/uploads/media/hero-banner.webp?v=2#x' })
  assert.equal(resolved.format, 'webp')
  assert.equal(resolved.source, 'fileUrl')
})

test('resolveAssetFormat: unknown format returns null without throwing', () => {
  const resolved = resolveAssetFormat({})
  assert.equal(resolved.format, null)
  assert.equal(resolved.source, null)
})

test('resolveAssetFormat: never throws for null/undefined or malformed metadata', () => {
  assert.doesNotThrow(() => resolveAssetFormat(null))
  assert.doesNotThrow(() => resolveAssetFormat(undefined))
  assert.doesNotThrow(() => resolveAssetFormat({ fileName: undefined as unknown as string }))
  assert.doesNotThrow(() => resolveAssetFormat({ fileName: '', extension: '', mimeType: '' }))
  assert.equal(resolveAssetFormat(null).format, null)
})

// ---------------------------------------------------------------------------
// validateAsset — the panel contract
// ---------------------------------------------------------------------------

const PLACEMENT = {
  key: 'HOMEPAGE_TOP',
  label: 'Homepage Top',
  description: '',
  page: '',
  position: '',
  visibility: '',
  priority: '',
  icon: null,
  backgroundOptions: [],
  specs: {
    recommendedWidth: 1600,
    recommendedHeight: 300,
    aspectRatio: '16:3',
    maxFileSize: '10 MB',
    formats: ['WebP', 'PNG', 'JPEG'],
    quality: 'High',
  },
} as never

function baseAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'asset-1',
    title: null,
    fileName: 'banner.webp',
    originalName: 'banner.webp',
    fileUrl: '/uploads/banner.webp',
    thumbnailUrl: null,
    mimeType: 'image/webp',
    extension: 'webp',
    fileSize: 1024,
    width: 1600,
    height: 300,
    altText: 'A banner',
    tags: [],
    folderId: null,
    uploaderId: 'user-1',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as never
}

function formatResults(asset: never) {
  return validateAsset(asset, PLACEMENT).filter((r) =>
    r.message.includes('format') || r.message.includes('Format')
  )
}

test('validateAsset: supported format passes for a full MediaAsset', () => {
  const results = formatResults(baseAsset())
  assert.equal(results.length, 1)
  assert.equal(results[0].passed, true)
  assert.equal(results[0].warning, false)
  assert.match(results[0].message, /supported/i)
})

test('validateAsset: unsupported format fails without crashing', () => {
  const results = formatResults(baseAsset({ fileName: 'vector.svg', mimeType: 'image/svg+xml', extension: 'svg' }))
  assert.equal(results.length, 1)
  assert.equal(results[0].passed, false)
  assert.equal(results[0].warning, false)
  assert.match(results[0].message, /not recommended/i)
  assert.match(results[0].details ?? '', /SVG/)
})

test('validateAsset: edit-flow DTO asset WITHOUT fileName no longer crashes and is flagged indeterminate only if nothing else resolves', () => {
  // Simulates the pre-fix AdminMediaAssetDto payload: originalName present.
  const legacyDto = baseAsset({ fileName: undefined }) as never
  assert.doesNotThrow(() => { validateAsset(legacyDto, PLACEMENT) })
  // originalName still identifies webp → format check behaves normally.
  const fmt = formatResults(legacyDto)
  assert.equal(fmt[0].passed, true)
  assert.match(fmt[0].message, /supported/i)
})

test('validateAsset: asset with NO filename/MIME/url yields controlled warning, never "supported"', () => {
  const unknown = baseAsset({ fileName: undefined, originalName: undefined, mimeType: undefined, extension: undefined, fileUrl: '' }) as never
  assert.doesNotThrow(() => { validateAsset(unknown, PLACEMENT) })
  const fmt = formatResults(unknown)
  assert.equal(fmt.length, 1)
  assert.equal(fmt[0].warning, true, 'indeterminate format must surface as a visible warning')
  assert.notEqual(fmt[0].message.toLowerCase().indexOf('could not be determined'), -1)
  assert.ok(!fmt[0].message.includes('Format is supported'), 'must not silently mark unknown format valid')
})

test('validateAsset: runs all non-format checks safely when metadata is missing', () => {
  const bare = baseAsset({
    fileName: undefined, originalName: undefined, mimeType: undefined,
    extension: undefined, fileSize: 0, width: null, height: null, altText: null,
  }) as never
  assert.doesNotThrow(() => { validateAsset(bare, PLACEMENT) })
  const results = validateAsset(bare, PLACEMENT)
  assert.ok(results.length > 0)
})

// ---------------------------------------------------------------------------
// Duplicate title convention helpers
// ---------------------------------------------------------------------------

test('stripCopySuffix removes trailing (Copy)/(Copy N) suffixes only', () => {
  assert.equal(stripCopySuffix('Summer Sale (Copy)'), 'Summer Sale')
  assert.equal(stripCopySuffix('Summer Sale (Copy 3)'), 'Summer Sale')
  assert.equal(stripCopySuffix('Summer Sale'), 'Summer Sale')
  assert.equal(stripCopySuffix('(Copy)'), '(Copy)')
  assert.equal(stripCopySuffix('Sale (Copy) Extra'), 'Sale (Copy) Extra')
})

test('buildCopyTitle produces the canonical convention', () => {
  assert.equal(buildCopyTitle('Original Title', 1), 'Original Title (Copy)')
  assert.equal(buildCopyTitle('Original Title', 2), 'Original Title (Copy 2)')
  assert.equal(buildCopyTitle('X (Copy)', 1), 'X (Copy) (Copy)')
})
