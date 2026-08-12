'use client'

import { useState } from 'react'
import { Search, RefreshCw, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const PLACEMENT_OPTIONS = [
  { value: '', label: 'All Placements' },
  { value: 'HOMEPAGE_HERO', label: 'Home Hero' },
  { value: 'HOMEPAGE_SEARCH', label: 'Home Search' },
  { value: 'HOMEPAGE_FEATURED', label: 'Home Featured' },
  { value: 'HOMEPAGE_SERVICES', label: 'Home Services' },
  { value: 'HOMEPAGE_BANKS', label: 'Home Banks' },
  { value: 'HOMEPAGE_CTA', label: 'Home CTA' },
  { value: 'BROKER_LISTING', label: 'Broker Listing' },
  { value: 'BROKER_LISTING_LOCAL', label: 'Broker Listing Local Resources' },
  { value: 'BROKER_PROFILE_HEADER', label: 'Broker Profile Header' },
  { value: 'BROKER_LISTING_SIDEBAR', label: 'Broker Listing Sidebar' },
  { value: 'LOAN_CALCULATOR', label: 'Loan Calculator' },
  { value: 'BLOG_INLINE', label: 'Blog Inline' },
  { value: 'FOOTER', label: 'Footer' },
  { value: 'ANNOUNCEMENT_TOP', label: 'Announcement Top' },
  { value: 'ANNOUNCEMENT_BOTTOM', label: 'Announcement Bottom' },
  { value: 'POPUP_OVERLAY', label: 'Popup Overlay' },
  { value: 'MOBILE_HEADER_BANNER', label: 'Mobile Header Banner' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'true', label: 'Published' },
  { value: 'false', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'HERO_BANNER', label: 'Hero Banner' },
  { value: 'SECTION_BANNER', label: 'Section Banner' },
  { value: 'INLINE_BANNER', label: 'Inline Banner' },
  { value: 'SIDEBAR_BANNER', label: 'Sidebar Banner' },
  { value: 'FOOTER_BANNER', label: 'Footer Banner' },
  { value: 'SPONSORED_BANNER', label: 'Sponsored Banner' },
  { value: 'POPUP_CAMPAIGN', label: 'Popup Campaign' },
  { value: 'ANNOUNCEMENT_BAR', label: 'Announcement Bar' },
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'priority_asc', label: 'Priority (Low to High)' },
  { value: 'priority_desc', label: 'Priority (High to Low)' },
  { value: 'title_asc', label: 'Title (A-Z)' },
  { value: 'title_desc', label: 'Title (Z-A)' },
]

interface AdvertisementToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  placement: string
  onPlacementChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  adType: string
  onAdTypeChange: (value: string) => void
  sort: string
  onSortChange: (value: string) => void
  onRefresh: () => void
  isLoading?: boolean
  selectedCount?: number
  onBulkAction?: (action: string) => void
}

export function AdvertisementToolbar({
  search,
  onSearchChange,
  placement,
  onPlacementChange,
  status,
  onStatusChange,
  adType,
  onAdTypeChange,
  sort,
  onSortChange,
  onRefresh,
  isLoading = false,
  selectedCount = 0,
  onBulkAction,
}: AdvertisementToolbarProps) {
  const [showFilters, setShowFilters] = useState(false)

  const hasActiveFilters = search || placement || status || adType

  const clearFilters = () => {
    onSearchChange('')
    onPlacementChange('')
    onStatusChange('')
    onAdTypeChange('')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search advertisements..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && 'bg-accent')}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg border bg-card">
          <Select value={placement} onValueChange={onPlacementChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Placement" />
            </SelectTrigger>
            <SelectContent>
              {PLACEMENT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={adType} onValueChange={onAdTypeChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={onSortChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
              <X className="mr-2 h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
      )}

      {/* Bulk Actions */}
      {selectedCount > 0 && onBulkAction && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-accent/50">
          <span className="text-sm font-medium">
            {selectedCount} advertisement{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => onBulkAction('enable')}>
              Publish
            </Button>
            <Button size="sm" variant="outline" onClick={() => onBulkAction('disable')}>
              Disable
            </Button>
            <Button size="sm" variant="outline" onClick={() => onBulkAction('archive')}>
              Archive
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onBulkAction('delete')}>
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
