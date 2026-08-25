'use client'

import { useState, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AdvertisementToolbar } from '@/components/admin/ads/AdvertisementToolbar'
import { AdvertisementTable } from '@/components/admin/ads/AdvertisementTable'
import { SectionHeader } from '@/components/admin/ads/SectionHeader'
import { DeleteDialog } from '@/components/admin/ads/DeleteDialog'
import { useAdminAds } from '@/hooks/useAdminAds'
import type { Advertisement } from '@/lib/advertisements/types'
import { toast } from 'react-hot-toast'
import { baseUrl } from '@/utils/baseUrl'

function AdminAdsListContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [placement, setPlacement] = useState(searchParams.get('placement') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [adType, setAdType] = useState(searchParams.get('adType') || '')
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const page = parseInt(searchParams.get('page') || '1')

  const { ads, total, error, mutate, isLoading } = useAdminAds({
    page,
    limit: 10,
    placement: placement || undefined,
    adType: adType || undefined,
    isEnabled: status === 'true' ? 'true' : status === 'false' ? 'false' : undefined,
    isArchived: status === 'archived' ? 'true' : undefined,
    search: search || undefined,
  })

  // Client-side sorting
  const sortedAds = useMemo(() => {
    const sorted = [...ads]
    switch (sort) {
      case 'oldest':
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'priority_asc':
        sorted.sort((a, b) => a.priority - b.priority)
        break
      case 'priority_desc':
        sorted.sort((a, b) => b.priority - a.priority)
        break
      case 'title_asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'title_desc':
        sorted.sort((a, b) => b.title.localeCompare(a.title))
        break
      case 'newest':
      default:
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
    }
    return sorted
  }, [ads, sort])

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })
      if (!updates.page) {
        params.delete('page')
      }
      router.push(`?${params.toString()}`)
    },
    [router, searchParams]
  )

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value)
      updateParams({ search: value, page: '1' })
    },
    [updateParams]
  )

  const handlePlacementChange = useCallback(
    (value: string) => {
      setPlacement(value)
      updateParams({ placement: value, page: '1' })
    },
    [updateParams]
  )

  const handleStatusChange = useCallback(
    (value: string) => {
      setStatus(value)
      updateParams({ status: value, page: '1' })
    },
    [updateParams]
  )

  const handleAdTypeChange = useCallback(
    (value: string) => {
      setAdType(value)
      updateParams({ adType: value, page: '1' })
    },
    [updateParams]
  )

  const handleSortChange = useCallback(
    (value: string) => {
      setSort(value)
      updateParams({ sort: value })
    },
    [updateParams]
  )

  const handleRefresh = useCallback(() => {
    mutate()
  }, [mutate])

  const handleBulkAction = useCallback(
    async (action: string) => {
      if (selectedIds.length === 0) return

      try {
        const response = await fetch(`${baseUrl}/api/admin/ads/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ids: selectedIds }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Bulk action failed')
        }

        toast.success(data.message || `Bulk ${action} completed successfully`)
        setSelectedIds([])
        mutate()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Bulk action failed'
        toast.error(message)
      }
    },
    [selectedIds, mutate]
  )

  const handleView = useCallback((ad: Advertisement) => {
    router.push(`/admin/ads/${ad.id}/preview`)
  }, [router])

  const handleEdit = useCallback((ad: Advertisement) => {
    router.push(`/admin/ads/${ad.id}/edit`)
  }, [router])

  const handleDuplicate = useCallback(
    async (ad: Advertisement) => {
      try {
        const response = await fetch(
          `${baseUrl}/api/admin/ads/${ad.id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'duplicate' }),
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Duplicate failed')
        }

        toast.success('Advertisement duplicated successfully')
        mutate()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Duplicate failed'
        toast.error(message)
      }
    },
    [mutate]
  )

  const handlePublish = useCallback(
    async (ad: Advertisement) => {
      try {
        const response = await fetch(
          `${baseUrl}/api/admin/ads/${ad.id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'publish' }),
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Publish failed')
        }

        toast.success('Advertisement published successfully')
        mutate()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Publish failed'
        toast.error(message)
      }
    },
    [mutate]
  )

  const handleDisable = useCallback(
    async (ad: Advertisement) => {
      try {
        const response = await fetch(
          `${baseUrl}/api/admin/ads/${ad.id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unpublish' }),
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Disable failed')
        }

        toast.success('Advertisement disabled successfully')
        mutate()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Disable failed'
        toast.error(message)
      }
    },
    [mutate]
  )

  const handleArchive = useCallback(
    async (ad: Advertisement) => {
      try {
        const response = await fetch(
          `${baseUrl}/api/admin/ads/${ad.id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'archive' }),
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Archive failed')
        }

        toast.success('Advertisement archived successfully')
        mutate()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Archive failed'
        toast.error(message)
      }
    },
    [mutate]
  )

  const handleRestore = useCallback(
    async (ad: Advertisement) => {
      try {
        const response = await fetch(
          `${baseUrl}/api/admin/ads/${ad.id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'restore' }),
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Restore failed')
        }

        toast.success('Advertisement restored successfully')
        mutate()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Restore failed'
        toast.error(message)
      }
    },
    [mutate]
  )

  const handleDelete = useCallback((ad: Advertisement) => {
    setDeleteTarget({ id: ad.id, title: ad.title || 'Untitled' })
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      const response = await fetch(
        `${baseUrl}/api/admin/ads/${deleteTarget.id}`,
        {
          method: 'DELETE',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Delete failed')
      }

      toast.success('Advertisement deleted successfully')
      setDeleteTarget(null)
      setSelectedIds(prev => prev.filter(id => id !== deleteTarget.id))
      mutate()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, mutate])

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Advertisements"
        description="Manage all your advertisement campaigns"
        actionLabel="New Advertisement"
        actionHref="/admin/ads/new"
      />

      <AdvertisementToolbar
        search={search}
        onSearchChange={handleSearch}
        placement={placement}
        onPlacementChange={handlePlacementChange}
        status={status}
        onStatusChange={handleStatusChange}
        adType={adType}
        onAdTypeChange={handleAdTypeChange}
        sort={sort}
        onSortChange={handleSortChange}
        onRefresh={handleRefresh}
        isLoading={isLoading}
        selectedCount={selectedIds.length}
        onBulkAction={handleBulkAction}
      />

      <AdvertisementTable
        ads={sortedAds}
        total={total}
        page={page}
        limit={10}
        isLoading={isLoading}
        error={error}
        search={search}
        onPageChange={(newPage) => {
          updateParams({ page: newPage.toString() })
          setSelectedIds([])
        }}
        onView={handleView}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onPublish={handlePublish}
        onDisable={handleDisable}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onDelete={handleDelete}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        itemName={deleteTarget?.title}
        isLoading={isDeleting}
      />
    </div>
  )
}

export default function AdminAdsListPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-text-muted">Loading advertisements...</p>
        </div>
      }
    >
      <AdminAdsListContent />
    </Suspense>
  )
}
