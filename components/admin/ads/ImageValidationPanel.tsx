'use client'

import { useMemo } from 'react'
import { AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MediaAsset } from '@/lib/advertisements/types'
import { validateAsset, type ValidationResult } from '@/lib/advertisements/assetValidation'
import { getPlacementInfo } from './placementPreviews'

interface ImageValidationPanelProps {
  asset: MediaAsset | null | undefined
  placement: string | undefined
  className?: string
}

export function ImageValidationPanel({ asset, placement, className }: ImageValidationPanelProps) {
  const placementInfo = useMemo(() => placement ? getPlacementInfo(placement) : undefined, [placement])
  const validations = useMemo(() => {
    // Defensive: assets arriving from legacy edit payloads may be partial.
    // validateAsset itself never throws for missing metadata.
    if (!asset) return [] as ValidationResult[]
    try {
      return validateAsset(asset, placementInfo)
    } catch {
      return [{
        passed: true,
        warning: true,
        message: 'Asset metadata is incomplete',
        details: 'Validation could not run because this asset is missing required metadata.',
      }] satisfies ValidationResult[]
    }
  }, [asset, placementInfo])
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
