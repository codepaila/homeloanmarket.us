/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useMemo, useCallback } from 'react'
import { useMediaAssets, useMediaFolders } from '@/hooks/useAdminAds'
import type { MediaAsset } from '@/lib/advertisements/types'
import { MediaToolbar } from '@/components/admin/media/MediaToolbar'
import { MediaGrid } from '@/components/admin/media/MediaGrid'
import { MediaList } from '@/components/admin/media/MediaList'
import { MediaGallery } from '@/components/admin/media/MediaGallery'
import { ImageDetailsDrawer } from '@/components/admin/media/ImageDetailsDrawer'
import { ImageEditDialog } from '@/components/admin/media/ImageEditDialog'
import { UploadDialog } from '@/components/admin/media/UploadDialog'
import { StorageDashboard } from '@/components/admin/media/StorageDashboard'
import { FolderManager } from '@/components/admin/media/FolderManager'
import { EmptyState } from '@/components/design/EmptyState'
import { SectionHeader } from '@/components/admin/ads/SectionHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FolderOpen, FileImage } from 'lucide-react'
import { cn } from '@/lib/utils'

type ViewMode = 'grid' | 'list' | 'gallery'

export default function MediaLibraryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('mediaViewMode') as ViewMode) || 'grid'
    }
    return 'grid'
  })
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [format, setFormat] = useState('all')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null)
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [activeTab, setActiveTab] = useState('library')

  const { assets, total, isLoading, mutate } = useMediaAssets({
    limit: 50,
    search: search || undefined,
    folderId: folderId || undefined,
  })
  const { folders } = useMediaFolders()

  const totalStorage = useMemo(() => assets.reduce((sum: number, a: any) => sum + (a.fileSize || 0), 0), [assets])

  const sortedAssets = useMemo(() => {
    const result = [...assets]
    switch (sort) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'name_asc':
        result.sort((a, b) => a.fileName.localeCompare(b.fileName))
        break
      case 'name_desc':
        result.sort((a, b) => b.fileName.localeCompare(a.fileName))
        break
      case 'size':
        result.sort((a, b) => (b.fileSize || 0) - (a.fileSize || 0))
        break
      case 'dimensions':
        result.sort((a, b) => (b.width || 0) - (a.width || 0))
        break
    }
    return result
  }, [assets, sort])

  const filteredAssets = useMemo(() => {
    if (format === 'all') return sortedAssets
    return sortedAssets.filter((a) => a.extension.toLowerCase() === format.toLowerCase())
  }, [sortedAssets, format])

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), [])
  const handleBulkDelete = useCallback(() => {
    selectedIds.forEach((id) => {
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/admin/media/${id}`, { method: 'DELETE' })
    })
    setSelectedIds(new Set())
    mutate()
  }, [selectedIds, mutate])
  const handleBulkMove = useCallback(() => {
    const folderId = prompt('Enter folder ID to move to:')
    if (!folderId) return
    selectedIds.forEach((id) => {
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/admin/media/${id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      })
    })
    setSelectedIds(new Set())
    mutate()
  }, [selectedIds, mutate])
  const handleBulkRestore = useCallback(() => {
    selectedIds.forEach((id) => {
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/admin/media/${id}/restore`, { method: 'POST' })
    })
    setSelectedIds(new Set())
    mutate()
  }, [selectedIds, mutate])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('mediaViewMode', mode)
  }, [])

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Media Library"
        description="Upload, manage, and organize your media assets"
        actionLabel="Upload Media"
        onAction={() => setShowUpload(true)}
      />

      <StorageDashboard />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="folders">Folders</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-6 mt-6">
          <MediaToolbar
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
            format={format}
            onFormatChange={setFormat}
            folderId={folderId}
            onFolderChange={setFolderId}
            onUpload={() => setShowUpload(true)}
            onRefresh={() => mutate()}
            selectedCount={selectedIds.size}
            onClearSelection={handleClearSelection}
            onBulkDelete={handleBulkDelete}
            onBulkMove={handleBulkMove}
            onBulkRestore={handleBulkRestore}
            totalAssets={total}
            totalStorage={totalStorage}
            showDeleted={showDeleted}
            onShowDeletedChange={setShowDeleted}
          />

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 rounded-lg border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : filteredAssets.length === 0 ? (
            <EmptyState
              title="No media assets"
              description="Upload your first image to get started"
              action={<Button onClick={() => setShowUpload(true)}>Upload Media</Button>}
              icon={<FileImage className="h-8 w-8 text-text-muted" />}
            />
          ) : (
            <>
              {viewMode === 'grid' && (
                <MediaGrid
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onSelectAsset={setSelectedAsset}
                  showDeleted={showDeleted}
                />
              )}
              {viewMode === 'list' && (
                <MediaList
                  assets={filteredAssets}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onSelectAsset={setSelectedAsset}
                  folders={folders}
                />
              )}
              {viewMode === 'gallery' && (
                <MediaGallery
                  assets={filteredAssets}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onSelectAsset={setSelectedAsset}
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="folders" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                Folder Manager
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FolderManager onSelectFolder={(id) => { setFolderId(id); setActiveTab('library'); }} selectedFolderId={folderId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ImageDetailsDrawer
        asset={selectedAsset}
        open={!!selectedAsset}
        onOpenChange={(open) => !open && setSelectedAsset(null)}
        onUpdated={() => mutate()}
      />

      <ImageEditDialog
        asset={editingAsset}
        open={!!editingAsset}
        onOpenChange={(open) => !open && setEditingAsset(null)}
        onUpdated={() => mutate()}
      />

      <UploadDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        folderId={folderId}
        onUploaded={() => mutate()}
      />
    </div>
  )
}
