// Canonical asset format resolution.
//
// Assets reach the admin UI from several sources whose shapes drifted apart:
// - Media Library API and upload API return full MediaAsset records
//   (fileName / originalName / mimeType / extension).
// - The edit flow (GET /api/admin/ads/[id]) returns serialized DTOs that
//   historically omitted fileName, so validators crashed on
//   `asset.fileName.split()`.
//
// This module is the SINGLE normalization point: it derives the file format
// from whatever metadata is actually present, never throws, and returns null
// when the format genuinely cannot be determined. It is dependency-free on
// purpose so client components can import it without pulling server modules.
import type { MediaAsset } from './types'

/**
 * Structural input: every field is optional because callers may receive
 * legacy/partial payloads. Full MediaAsset records satisfy it structurally.
 */
export type AssetFormatSource = Partial<Pick<MediaAsset,
  'fileName' | 'originalName' | 'mimeType' | 'extension' | 'fileUrl'
>>

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

function extensionFromName(name: string | null | undefined): string | null {
  if (!name || typeof name !== 'string') return null
  const match = name.match(/\.([A-Za-z0-9]+)$/)
  if (!match) return null
  const ext = match[1].toLowerCase()
  return ext.length > 0 ? ext : null
}

export function extensionFromMimeType(mimeType: string | null | undefined): string | null {
  if (!mimeType || typeof mimeType !== 'string') return null
  const mapped = MIME_EXTENSION_MAP[mimeType.trim().toLowerCase()]
  return mapped ?? null
}

function basenameFromUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl || typeof fileUrl !== 'string') return null
  try {
    const path = fileUrl.split('?')[0]?.split('#')[0] ?? ''
    const base = path.substring(path.lastIndexOf('/') + 1)
    return base.length > 0 ? base : null
  } catch {
    return null
  }
}

export interface ResolvedAssetFormat {
  /** Lowercase extension without the dot, or null when undeterminable. */
  format: string | null
  /** Which metadata field produced the result — useful for diagnostics/tests. */
  source: 'extension' | 'fileName' | 'originalName' | 'mimeType' | 'fileUrl' | null
}

/**
 * Derive the asset's file format from the first reliable source:
 * explicit extension → stored fileName → original upload name →
 * MIME type → URL basename. Never throws; returns format:null when
 * nothing can be determined.
 */
export function resolveAssetFormat(asset: AssetFormatSource | null | undefined): ResolvedAssetFormat {
  if (!asset) return { format: null, source: null }

  if (typeof asset.extension === 'string' && asset.extension.trim() !== '') {
    return { format: asset.extension.trim().toLowerCase().replace(/^\./, ''), source: 'extension' }
  }

  const fromFileName = extensionFromName(asset.fileName)
  if (fromFileName) return { format: fromFileName, source: 'fileName' }

  const fromOriginalName = extensionFromName(asset.originalName)
  if (fromOriginalName) return { format: fromOriginalName, source: 'originalName' }

  const fromMime = extensionFromMimeType(asset.mimeType)
  if (fromMime) return { format: fromMime, source: 'mimeType' }

  const fromUrl = extensionFromName(basenameFromUrl(asset.fileUrl))
  if (fromUrl) return { format: fromUrl, source: 'fileUrl' }

  return { format: null, source: null }
}
