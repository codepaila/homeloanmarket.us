'use client'

import { useMemo } from 'react'
import { AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MediaAsset } from '@/lib/advertisements/types'
import { getPlacementInfo, type PlacementInfo } from './placementPreviews'

interface ImageValidationPanelProps {
  asset: MediaAsset | null | undefined
  placement: string | undefined
  className?: string
}

interface ValidationResult {
  passed: boolean
  warning: boolean
  message: string
  details?: string
}

export function ImageValidationPanel({ asset, placement, className }: ImageValidationPanelProps) {
  const placementInfo = useMemo(() => placement ? getPlacementInfo(placement) : undefined, [placement])
  const validations = useMemo(() => asset ? validateAsset(asset, placementInfo) : [], [asset, placementInfo])
  const errorCount = validations.filter(v => !v.passed && !v.warning).length
  const warningCount = validations.filter(v => v.warning).length

  if (!asset) {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
        <p className="text-sm text-text-muted">No media selected</p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Image Validation</h4>
        <div className="flex items-center gap-2">
          {errorCount === 0 && warningCount === 0 && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle className="h-3 w-3" />
              All checks passed
            </span>
          )}
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {errorCount} issue{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && errorCount === 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <Info className="h-3 w-3" />
              {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {validations.map((validation, index) => (
          <div key={index} className="flex items-start gap-2">
            {validation.passed && !validation.warning ? (
              <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
            ) : validation.warning ? (
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-xs font-medium',
                validation.passed && !validation.warning ? 'text-success' :
                validation.warning ? 'text-amber-600' : 'text-destructive'
              )}>
                {validation.message}
              </p>
              {validation.details && (
                <p className="text-xs text-text-muted mt-0.5">{validation.details}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function validateAsset(asset: MediaAsset, placementInfo: PlacementInfo | undefined): ValidationResult[] {
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

  // Format validation
  if (placementInfo) {
    const extension = asset.fileName.split('.').pop()?.toLowerCase()
    const supportedFormats = placementInfo.specs.formats.map(f => f.toLowerCase())

    if (extension && !supportedFormats.includes(extension)) {
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

function parseAspectRatio(ratio: string): [number, number] {
  const parts = ratio.split(':').map(Number)
  if (parts.length === 2) {
    return [parts[0], parts[1]]
  }
  return [16, 9]
}

function parseMaxFileSize(maxSize: string): number {
  const match = maxSize.match(/(\d+(?:\.\d+)?)\s*(MB|GB|KB)?/i)
  if (!match) return 10
  const value = parseFloat(match[1])
  const unit = (match[2] || 'MB').toUpperCase()
  if (unit === 'GB') return value * 1024
  if (unit === 'KB') return value / 1024
  return value
}
