'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { EmptyState, NoSearchResults } from '@/components/design/EmptyState'
import { TableRowSkeleton } from './LoadingSkeleton'
import { AdvertisementStatusBadge, getAdStatus } from './AdvertisementStatusBadge'
import { PlacementBadge } from './PlacementBadge'
import { PriorityBadge } from './PriorityBadge'
import { AdvertisementActionsDropdown } from './AdvertisementActionsDropdown'
import type { Advertisement } from '@/lib/advertisements/types'

interface AdvertisementTableProps {
  ads: Advertisement[]
  total: number
  page: number
  limit: number
  isLoading?: boolean
  error?: Error | null
  search?: string
  onPageChange: (page: number) => void
  onView?: (ad: Advertisement) => void
  onEdit?: (ad: Advertisement) => void
  onDuplicate?: (ad: Advertisement) => void
  onPublish?: (ad: Advertisement) => void
  onDisable?: (ad: Advertisement) => void
  onArchive?: (ad: Advertisement) => void
  onRestore?: (ad: Advertisement) => void
  onDelete?: (ad: Advertisement) => void
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
}

export function AdvertisementTable({
  ads,
  total,
  page,
  limit,
  isLoading = false,
  error = null,
  search,
  onPageChange,
  onView,
  onEdit,
  onDuplicate,
  onPublish,
  onDisable,
  onArchive,
  onRestore,
  onDelete,
  selectedIds = [],
  onSelectionChange,
}: AdvertisementTableProps) {
  const totalPages = Math.ceil(total / limit) || 1

  const isAllSelected = ads.length > 0 && selectedIds.length === ads.length

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange?.(ads.map(ad => ad.id))
    } else {
      onSelectionChange?.([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange?.([...selectedIds, id])
    } else {
      onSelectionChange?.(selectedIds.filter(selectedId => selectedId !== id))
    }
  }

  const sortedAds = useMemo(() => {
    return [...ads]
  }, [ads])

  if (error) {
    return (
      <div className="rounded border">
        <EmptyState
          title="Failed to load advertisements"
          description={error.message || 'An error occurred while fetching data. Please try again.'}
          icon={<ImageIcon className="h-12 w-12 text-muted-foreground" />}
          action={
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  if (!isLoading && ads.length === 0) {
    if (search) {
      return (
        <div className="rounded border">
          <NoSearchResults
            searchTerm={search}
            onClear={() => onSelectionChange?.([])}
          />
        </div>
      )
    }

    return (
      <div className="rounded border">
        <EmptyState
          title="No advertisements yet"
          description="Get started by creating your first advertisement campaign."
          icon={<ImageIcon className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
    )
  }

  return (
    <div className="rounded border bg-card">
      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-16">Preview</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="hidden md:table-cell">Placement</TableHead>
              <TableHead className="hidden lg:table-cell">Type</TableHead>
              <TableHead className="hidden xl:table-cell">Priority</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">Start Date</TableHead>
              <TableHead className="hidden lg:table-cell">End Date</TableHead>
              <TableHead className="hidden xl:table-cell">Updated</TableHead>
              <TableHead className="w-12">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))
            ) : (
              sortedAds.map((ad) => {
                const status = getAdStatus(ad)
                const isSelected = selectedIds.includes(ad.id)
                const previewUrl = ad.desktopMedia?.thumbnailUrl || ad.desktopMedia?.fileUrl || ad.bannerUrl

                return (
                  <TableRow
                    key={ad.id}
                    data-selected={isSelected}
                    className={isSelected ? 'bg-muted/50' : ''}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectOne(ad.id, checked as boolean)}
                        aria-label={`Select ${ad.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                        {previewUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewUrl}
                              alt={ad.altText || ad.title || 'Advertisement'}
                              className="h-full w-full object-cover"
                            />
                          </>
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[200px]">{ad.title}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {ad.description || 'No description'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <PlacementBadge placement={ad.placement} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {ad.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <PriorityBadge priority={ad.priority} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <AdvertisementStatusBadge status={status} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {ad.startDate ? format(new Date(ad.startDate), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {ad.endDate ? format(new Date(ad.endDate), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                      {format(new Date(ad.updatedAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <AdvertisementActionsDropdown
                        ad={ad}
                        onView={onView}
                        onEdit={onEdit}
                        onDuplicate={onDuplicate}
                        onPublish={onPublish}
                        onDisable={onDisable}
                        onArchive={onArchive}
                        onRestore={onRestore}
                        onDelete={onDelete}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && ads.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} advertisements
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 7) {
                  pageNum = i + 1
                } else if (page <= 4) {
                  pageNum = i + 1
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i
                } else {
                  pageNum = page - 3 + i
                }

                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? 'default' : 'ghost'}
                    size="icon-sm"
                    onClick={() => onPageChange(pageNum)}
                    className="hidden sm:flex"
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
