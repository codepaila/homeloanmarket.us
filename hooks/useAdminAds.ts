'use client'

import useSWR, { useSWRConfig } from 'swr'
import { useState } from 'react'
import { baseUrl } from '@/utils/baseUrl'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    const error = new Error(data.message || data.error || 'Failed to fetch data')
    throw error
  }
  return data
}

// ==================== DASHBOARD STATS ====================

export function useAdminAdStats() {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/admin/ads/stats`,
    fetcher
  )

  const stats = data?.stats || null
  return { stats, error, mutate, isLoading }
}

// ==================== ADVERTISEMENTS LIST ====================

export function useAdminAds(params: {
  page?: number
  limit?: number
  placement?: string
  adType?: string
  isEnabled?: string
  isArchived?: string
  search?: string
} = {}) {
  const {
    page = 1,
    limit = 10,
    placement,
    adType,
    isEnabled,
    isArchived,
    search,
  } = params

  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  queryParams.append('limit', limit.toString())
  if (placement) queryParams.append('placement', placement)
  if (adType) queryParams.append('adType', adType)
  if (isEnabled !== undefined) queryParams.append('isEnabled', isEnabled)
  if (isArchived !== undefined) queryParams.append('isArchived', isArchived)
  if (search) queryParams.append('search', search)

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/admin/ads?${queryParams.toString()}`,
    fetcher
  )

  const ads = data?.ads || []
  const total = data?.total || 0
  const totalPages = data?.totalPages || 0

  return { ads, total, totalPages, page, limit, error, mutate, isLoading }
}

// ==================== SINGLE ADVERTISEMENT ====================

export function useAdminAd(id: string) {
  const { data, error, mutate, isLoading } = useSWR(
    id ? `${baseUrl}/api/admin/ads/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  return {
    ad: data?.ad || null,
    metrics: data?.metrics || null,
    error,
    mutate,
    isLoading,
  }
}

// ==================== MEDIA ASSETS ====================

export function useMediaAssets(params: {
  page?: number
  limit?: number
  search?: string
  folderId?: string
} = {}) {
  const {
    page = 1,
    limit = 50,
    search,
    folderId,
  } = params

  const queryParams = new URLSearchParams()
  queryParams.append('page', page.toString())
  queryParams.append('limit', limit.toString())
  if (search) queryParams.append('search', search)
  if (folderId) queryParams.append('folderId', folderId)

  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/admin/media?${queryParams.toString()}`,
    fetcher
  )

  const assets = data?.assets || []
  const total = data?.total || 0

  return { assets, total, error, mutate, isLoading }
}

// ==================== MEDIA FOLDERS ====================

export function useMediaFolders() {
  const { data, error, mutate, isLoading } = useSWR(
    `${baseUrl}/api/admin/media/folders`,
    fetcher
  )

  const folders = data?.folders || []
  return { folders, error, mutate, isLoading }
}

// ==================== FOLDER OPERATIONS ====================

export function useCreateFolder() {
  const { mutate } = useSWRConfig()

  const create = async (data: { name: string; parentId?: string | null }) => {
    const res = await fetch(`${baseUrl}/api/admin/media/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error || 'Failed to create folder')
    mutate(`${baseUrl}/api/admin/media/folders`)
    mutate(`${baseUrl}/api/admin/media`)
    return result.folder
  }

  return { createFolder: create }
}

export function useUpdateFolder() {
  const { mutate } = useSWRConfig()

  const update = async (id: string, data: { name: string }) => {
    const res = await fetch(`${baseUrl}/api/admin/media/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error || 'Failed to update folder')
    mutate(`${baseUrl}/api/admin/media/folders`)
    return result.folder
  }

  return { updateFolder: update }
}

export function useDeleteFolder() {
  const { mutate } = useSWRConfig()

  const remove = async (id: string) => {
    const res = await fetch(`${baseUrl}/api/admin/media/folders/${id}`, {
      method: 'DELETE',
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error || 'Failed to delete folder')
    mutate(`${baseUrl}/api/admin/media/folders`)
    mutate(`${baseUrl}/api/admin/media`)
  }

  return { deleteFolder: remove }
}

// ==================== ASSET OPERATIONS ====================

export function useUpdateAsset() {
  const [isPending, setIsPending] = useState(false)
  const { mutate } = useSWRConfig()

  const update = async (id: string, data: { title?: string; altText?: string }) => {
    setIsPending(true)
    try {
      const res = await fetch(`${baseUrl}/api/admin/media/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to update asset')
      mutate(`${baseUrl}/api/admin/media`)
      return result.asset
    } finally {
      setIsPending(false)
    }
  }

  return { updateAsset: update, isPending }
}

export function useDeleteAsset() {
  const [isPending, setIsPending] = useState(false)
  const { mutate } = useSWRConfig()

  const remove = async (id: string) => {
    setIsPending(true)
    try {
      const res = await fetch(`${baseUrl}/api/admin/media/${id}`, {
        method: 'DELETE',
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to delete asset')
      mutate(`${baseUrl}/api/admin/media`)
    } finally {
      setIsPending(false)
    }
  }

  return { deleteAsset: remove, isPending }
}

export function useRestoreAsset() {
  const [isPending, setIsPending] = useState(false)
  const { mutate } = useSWRConfig()

  const restore = async (id: string) => {
    setIsPending(true)
    try {
      const res = await fetch(`${baseUrl}/api/admin/media/${id}/restore`, {
        method: 'POST',
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to restore asset')
      mutate(`${baseUrl}/api/admin/media`)
      return result.asset
    } finally {
      setIsPending(false)
    }
  }

  return { restoreAsset: restore, isPending }
}

export function useMoveAsset() {
  const [isPending, setIsPending] = useState(false)
  const { mutate } = useSWRConfig()

  const move = async (id: string, folderId: string | null) => {
    setIsPending(true)
    try {
      const res = await fetch(`${baseUrl}/api/admin/media/${id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to move asset')
      mutate(`${baseUrl}/api/admin/media`)
      return result.asset
    } finally {
      setIsPending(false)
    }
  }

  return { moveAsset: move, isPending }
}

export function useUploadAsset() {
  const [isPending, setIsPending] = useState(false)
  const { mutate } = useSWRConfig()

  const upload = async (formData: FormData) => {
    setIsPending(true)
    try {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'POST',
        body: formData,
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to upload asset')
      mutate(`${baseUrl}/api/admin/media`)
      return result.asset
    } finally {
      setIsPending(false)
    }
  }

  return { uploadAsset: upload, isPending }
}

// ==================== ADVERTISEMENT ACTIONS ====================

export function useAdvertisement(id: string | null) {
  const { data, error, mutate, isLoading } = useSWR(
    id ? `${baseUrl}/api/admin/ads/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  return {
    data: data?.ad || null,
    isLoading,
    error,
    mutate,
  }
}

export function useArchiveAdvertisement() {
  const [isPending, setIsPending] = useState(false)
  const { mutate } = useSWRConfig()

  const archive = async (id: string) => {
    setIsPending(true)
    try {
      const res = await fetch(`${baseUrl}/api/admin/ads/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to archive advertisement')
      mutate(`${baseUrl}/api/admin/ads`)
      mutate(`${baseUrl}/api/admin/ads/stats`)
      return result.ad
    } finally {
      setIsPending(false)
    }
  }

  return { mutateAsync: archive, isPending }
}

export function useDuplicateAdvertisement() {
  const [isPending, setIsPending] = useState(false)
  const { mutate } = useSWRConfig()

  const duplicate = async (params: { id: string; title?: string; copyImages?: boolean; copySchedule?: boolean; copyPriority?: boolean; copyStatus?: boolean; copyButtonSettings?: boolean }) => {
    const { id, ...data } = params
    setIsPending(true)
    try {
      const res = await fetch(`${baseUrl}/api/admin/ads/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', ...data }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to duplicate advertisement')
      mutate(`${baseUrl}/api/admin/ads`)
      mutate(`${baseUrl}/api/admin/ads/stats`)
      return result.ad
    } finally {
      setIsPending(false)
    }
  }

  return { mutateAsync: duplicate, isPending }
}

export function useToast() {
  return {
    toast: ({ title, description, variant }: { title: string; description: string; variant?: string }) => {
      import('react-hot-toast').then(({ default: toast }) => {
        toast[variant === 'destructive' ? 'error' : 'success'](title + (description ? `: ${description}` : ''))
      })
    },
    success: (message: string) => {
      import('react-hot-toast').then(({ default: toast }) => toast.success(message))
    },
    error: (message: string) => {
      import('react-hot-toast').then(({ default: toast }) => toast.error(message))
    },
    info: (message: string) => {
      import('react-hot-toast').then(({ default: toast }) => toast(message))
    },
    warning: (message: string) => {
      import('react-hot-toast').then(({ default: toast }) => toast(message, { icon: '⚠️' }))
    },
  }
}

