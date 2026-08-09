/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import { Search, FolderOpen, Grid3X3, List, LayoutGrid, Upload, RefreshCw, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMediaAssets, useMediaFolders } from '@/hooks/useAdminAds'
import { cn, formatFileSize } from '@/lib/utils'

type ViewMode = 'grid' | 'list' | 'gallery'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'size', label: 'File Size' },
  { value: 'dimensions', label: 'Dimensions' },
]

const FORMAT_OPTIONS = [
  { value: 'all', label: 'All Formats' },
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
  { value: 'gif', label: 'GIF' },
  { value: 'svg', label: 'SVG' },
]

interface MediaToolbarProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  search: string
  onSearchChange: (search: string) => void
  sort: string
  onSortChange: (sort: string) => void
  format: string
  onFormatChange: (format: string) => void
  folderId: string | null
  onFolderChange: (folderId: string | null) => void
  onUpload: () => void
  onRefresh: () => void
  selectedCount: number
  onClearSelection: () => void
  onBulkDelete: () => void
  onBulkMove: () => void
  onBulkRestore: () => void
  totalAssets: number
  totalStorage: number
  showDeleted: boolean
  onShowDeletedChange: (show: boolean) => void
}

export function MediaToolbar({
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
  format,
  onFormatChange,
  folderId,
  onFolderChange,
  onUpload,
  onRefresh,
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkMove,
  onBulkRestore,
  totalAssets,
  totalStorage,
  showDeleted,
  onShowDeletedChange,
}: MediaToolbarProps) {
  const { folders } = useMediaFolders()

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex-1 w-full lg:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Search by filename, title, alt text, tags..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onUpload} size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <div className="flex border border-border rounded-md">
            <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" onClick={() => onViewModeChange('grid')}>
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" onClick={() => onViewModeChange('list')}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'gallery' ? 'default' : 'ghost'} size="icon" onClick={() => onViewModeChange('gallery')}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={folderId || 'all'} onValueChange={(v) => onFolderChange(v === 'all' ? null : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All folders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Folders</SelectItem>
            {folders.map((folder: { id: string; name: string }) => (
              <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={format} onValueChange={onFormatChange}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            {FORMAT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant={showDeleted ? 'default' : 'outline'}
            size="sm"
            onClick={() => onShowDeletedChange(!showDeleted)}
          >
            {showDeleted ? 'Showing Deleted' : 'Show Deleted'}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-text-muted">
        <div className="flex items-center gap-4">
          <span>{totalAssets} asset{totalAssets !== 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            {formatFileSize(totalStorage)}
          </span>
        </div>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <Badge variant="secondary">{selectedCount} selected</Badge>
            <Button variant="ghost" size="sm" onClick={onClearSelection}>Clear</Button>
            <Button variant="outline" size="sm" onClick={onBulkMove}>Move</Button>
            <Button variant="outline" size="sm" onClick={onBulkRestore}>Restore</Button>
            <Button variant="destructive" size="sm" onClick={onBulkDelete}>Delete</Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
