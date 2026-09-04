'use client'

import { Building2, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminCompanies } from '@/hooks/useAdminAds'
import type { AdvertisementOwner, AdvertisementRequestContext } from '@/lib/advertisements/types'

export function OwnerSelector({
  value,
  onChange,
  requestContext,
  disabled = false,
}: {
  value: AdvertisementOwner
  onChange: (owner: AdvertisementOwner) => void
  requestContext?: AdvertisementRequestContext
  disabled?: boolean
}) {
  const { companies, isLoading } = useAdminCompanies()

  // When creating from a company request, ownership is locked to the request's
  // company. The admin is never asked to pick a company in that flow.
  if (requestContext) {
    const company = companies.find((c) => c.id === requestContext.companyId)
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">Advertisement Owner</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded border border-border bg-muted/30 p-4">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary" aria-hidden="true">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</p>
              <p className="truncate font-semibold text-foreground">{company?.name || 'Linked company'}</p>
            </div>
            <span className="ml-auto shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Locked</span>
          </div>
          <p className="text-xs text-muted-foreground">Ownership is derived from the company request and cannot be changed.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">Advertisement Owner</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          role="radio"
          aria-checked={value.type === 'PLATFORM'}
          disabled={disabled}
          onClick={() => onChange({ type: 'PLATFORM', companyId: null })}
          className={cn(
            'flex items-start gap-3 rounded border p-4 text-left transition-colors disabled:opacity-60',
            value.type === 'PLATFORM' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50',
          )}
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary" aria-hidden="true">
            <Globe className="h-4 w-4" />
          </span>
          <span>
            <span className="block font-medium text-foreground">Platform / No Company</span>
            <span className="mt-1 block text-xs text-muted-foreground">The advertisement is owned by the platform and appears per its placement rules.</span>
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={value.type === 'COMPANY'}
          disabled={disabled}
          onClick={() => onChange(value.type === 'COMPANY' ? value : { type: 'COMPANY', companyId: '' })}
          className={cn(
            'flex items-start gap-3 rounded border p-4 text-left transition-colors disabled:opacity-60',
            value.type === 'COMPANY' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50',
          )}
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary" aria-hidden="true">
            <Building2 className="h-4 w-4" />
          </span>
          <span>
            <span className="block font-medium text-foreground">Specific Company</span>
            <span className="mt-1 block text-xs text-muted-foreground">The advertisement is owned by an active company.</span>
          </span>
        </button>
      </div>

      {value.type === 'COMPANY' && (
        <div className="space-y-2">
          <label htmlFor="advertisement-company-select" className="block text-sm font-medium text-foreground">
            Company
          </label>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading companies…</p>
          ) : (
            <select
              id="advertisement-company-select"
              value={value.companyId}
              disabled={disabled}
              onChange={(event) => onChange({ type: 'COMPANY', companyId: event.target.value })}
              className="w-full rounded border bg-background px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select an active company
              </option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          )}
          {!isLoading && companies.length === 0 && (
            <p className="text-sm text-muted-foreground">No active companies are available.</p>
          )}
        </div>
      )}
    </section>
  )
}
