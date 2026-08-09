import type { Advertisement, MediaAsset } from "./types"
import type { AdvertisementFormat } from './formats'

export interface CreateFolderDto {
  name: string
  parentId?: string
}

export interface UploadMediaDto {
  file: File
  altText: string
  title?: string
  folderId?: string | null
  tags?: string[]
  uploaderId: string
}

export interface UpdateMediaDto {
  title?: string
  altText?: string
}

export interface CreateAdvertisementDto {
  title: string
  description?: string
  placement: string
  type: string
  action: string
  buttonVariant?: string
  desktopMediaId?: string | null
  mobileMediaId?: string | null
  altText?: string
  bannerUrl?: string
  buttonLabel?: string
  buttonUrl?: string
  openInNewTab?: boolean
  displayOrder?: number
  priority?: number
  startDate?: Date | null
  endDate?: Date | null
  isEnabled?: boolean
  showDesktop?: boolean
  showTablet?: boolean
  showMobile?: boolean
  internalNotes?: string
  isDismissible?: boolean
  creativeAssignments?: Array<{ mediaAssetId: string; format: AdvertisementFormat }>
  createdById: string
}

export interface UpdateAdvertisementDto extends Partial<CreateAdvertisementDto> {
  isArchived?: boolean
  isDeleted?: boolean
  slug?: string
  updatedById?: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface MediaAssetResponse extends Omit<MediaAsset, "uploaderId"> {
  uploader?: { id: string; name: string | null; email: string | null }
  folder?: { id: string; name: string; path: string } | null
}

export interface AdvertisementResponse extends Omit<Advertisement, "createdById" | "updatedById"> {
  createdBy?: { id: string; name: string | null; email: string | null } | null
  updatedBy?: { id: string; name: string | null; email: string | null } | null
  desktopMedia?: MediaAsset | null
  mobileMedia?: MediaAsset | null
  metrics?: { impressions: number; clicks: number }
}
