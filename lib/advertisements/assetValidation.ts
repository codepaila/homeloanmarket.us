// Pure advertisement asset validation rules, shared by the admin
// ImageValidationPanel and regression tests. No React/DOM imports so the
// logic can run under node:test.
import type { MediaAsset } from './types'
import { resolveAssetFormat } from './assetFormat'
import type { PlacementInfo } from '@/components/admin/ads/placementPreviews'

export interface ValidationResult {
  passed: boolean
  warning: boolean
  message: string
  details?: string
}

export function validateAsset(asset: MediaAsset, placementInfo: PlacementInfo | undefined): ValidationResult[] {
  const results: ValidationResult[] = []

  // File size validation
  if (asset.fileSize) {
    const sizeKB = asset.fileSize / 1024
    const sizeMB = sizeKB / 1024
    const maxSizeMB = placementInfo ? parseMaxFileSize(placementInfo.specs.maxFileSize) : 10

    if (sizeMB > maxSizeMB) {
      results.push({
        passed: false,
        warning: false,
        message: 'File size exceeds recommendation',
        details: `${sizeMB.toFixed(1)} MB (recommended max: ${maxSizeMB} MB)`,
      })
    } else if (sizeMB > maxSizeMB * 0.8) {
      results.push({
        passed: true,
        warning: true,
        message: 'File size is approaching limit',
        details: `${sizeMB.toFixed(1)} MB of ${maxSizeMB} MB recommended`,
      })
    } else {
      results.push({
        passed: true,
        warning: false,
        message: 'File size is optimal',
        details: `${sizeMB.toFixed(1)} MB`,
      })
    }
  }

  // Dimensions validation
  if (asset.width && asset.height && placementInfo) {
    const { recommendedWidth, recommendedHeight, aspectRatio } = placementInfo.specs
    const [expectedW, expectedH] = parseAspectRatio(aspectRatio)
    const actualRatio = asset.width / asset.height
    const expectedRatio = expectedW / expectedH
    const ratioDiff = Math.abs(actualRatio - expectedRatio) / expectedRatio
    const isFullWidthTop = placementInfo.specs.maxDisplayHeight !== undefined

    if (ratioDiff > 0.2) {
      if (isFullWidthTop && actualRatio < expectedRatio) {
        results.push({
          passed: true,
          warning: true,
          message: 'Image is taller than the recommended banner ratio',
          details: `Recommended creative is ${recommendedWidth} × ${recommendedHeight} (${aspectRatio}). This image is taller than the recommended banner ratio and may not display optimally.`,
        })
      } else {
        results.push({
          passed: false,
          warning: false,
          message: 'Aspect ratio differs significantly from recommendation',
          details: `Actual: ${actualRatio.toFixed(2)}:1, Recommended: ${expectedRatio.toFixed(2)}:1 (${aspectRatio})`,
        })
      }
    } else if (ratioDiff > 0.1) {
      results.push({
        passed: true,
        warning: true,
        message: 'Aspect ratio slightly differs from recommendation',
        details: `Actual: ${actualRatio.toFixed(2)}:1, Recommended: ${expectedRatio.toFixed(2)}:1`,
      })
    } else {
      results.push({
        passed: true,
        warning: false,
        message: 'Aspect ratio matches recommendation',
        details: `${actualRatio.toFixed(2)}:1 (${aspectRatio})`,
      })
    }

    if (asset.width < recommendedWidth || asset.height < recommendedHeight) {
      results.push({
        passed: true,
        warning: true,
        message: 'Image is smaller than recommended dimensions',
        details: `Actual: ${asset.width}×${asset.height}, Recommended: ${recommendedWidth}×${recommendedHeight}`,
      })
    } else if (asset.width >= recommendedWidth && asset.height >= recommendedHeight) {
      results.push({
        passed: true,
        warning: false,
        message: 'Dimensions meet or exceed recommendations',
        details: `${asset.width}×${asset.height}`,
      })
    }
  }

  // Format validation. The format is resolved through the canonical asset
  // format contract so missing fileName can never crash here. When the format
  // cannot be determined we surface a controlled warning instead of silently
  // marking the asset as supported.
  if (placementInfo) {
    const resolved = resolveAssetFormat(asset)
    const extension = resolved.format
    const supportedFormats = placementInfo.specs.formats.map(f => f.toLowerCase())

    if (!extension) {
      results.push({
        passed: true,
        warning: true,
        message: 'Asset format could not be determined',
        details: 'File metadata (fileName/extension/MIME type) is missing, so the format could not be checked against this placement.',
      })
    } else if (!supportedFormats.includes(extension)) {
      results.push({
        passed: false,
        warning: false,
        message: 'Format not recommended for this placement',
        details: `Current: ${extension.toUpperCase()}, Recommended: ${placementInfo.specs.formats.join(', ')}`,
      })
    } else {
      results.push({
        passed: true,
        warning: false,
        message: 'Format is supported',
        details: placementInfo ? `Recommended: ${placementInfo.specs.formats.join(', ')}` : undefined,
      })
    }
  }

  // Alt text validation
  if (!asset.altText || asset.altText.trim() === '') {
    results.push({
      passed: true,
      warning: true,
      message: 'Alt text is missing',
      details: 'Adding alt text improves accessibility and SEO',
    })
  } else {
    results.push({
      passed: true,
      warning: false,
      message: 'Alt text is present',
    })
  }

  return results
}

export function parseAspectRatio(ratio: string): [number, number] {
  const parts = ratio.split(':').map(Number)
  if (parts.length === 2) {
    return [parts[0], parts[1]]
  }
  return [16, 9]
}

export function parseMaxFileSize(maxSize: string): number {
  const match = maxSize.match(/(\d+(?:\.\d+)?)\s*(MB|GB|KB)?/i)
  if (!match) return 10
  const value = parseFloat(match[1])
  const unit = (match[2] || 'MB').toUpperCase()
  if (unit === 'GB') return value * 1024
  if (unit === 'KB') return value / 1024
  return value
}
