import type { Advertisement, MediaAsset } from '@/lib/advertisements/types'
import type { AdvertisementFormat } from '@/lib/advertisements/formats'

export type AdminMediaAssetDto = {
  id: string
  fileUrl: string
  thumbnailUrl: string | null
  altText: string | null
  originalName: string
  fileSize: number
  width: number | null
  height: number | null
}

export type AdvertisementCreativeDto = {
  id: string
  mediaAssetId: string
  format: AdvertisementFormat
  mediaAsset: AdminMediaAssetDto | null
}

export type AdvertisementAdminDTO = {
  id: string
  title: string
  slug: string
  description: string | null
  placement: string
  type: string
  action: string
  buttonVariant: string
  desktopMediaId: string | null
  mobileMediaId: string | null
  altText: string | null
  bannerUrl: string | null
  buttonLabel: string | null
  buttonUrl: string | null
  openInNewTab: boolean
  displayOrder: number
  priority: number
  startDate: string | null
  endDate: string | null
  isEnabled: boolean
  isArchived: boolean
  showDesktop: boolean
  showTablet: boolean
  showMobile: boolean
  createdById: string
  updatedById: string | null
  internalNotes: string | null
  isDismissible: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  desktopMedia: AdminMediaAssetDto | null
  mobileMedia: AdminMediaAssetDto | null
  creatives: AdvertisementCreativeDto[]
  createdBy: { id: string; name: string | null; email: string | null } | null
  companyId: string | null
  locationTarget: {
    locationLabel: string
    countryCode: string
    city: string | null
    state: string | null
    zip: string | null
    googlePlaceId: string | null
    latitude: number
    longitude: number
    radiusMiles: number
  } | null
}

export function toISOStringSafe(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function serializeMedia(asset: MediaAsset | null | undefined): AdminMediaAssetDto | null {
  if (!asset) return null
  return {
    id: asset.id,
    fileUrl: asset.fileUrl,
    thumbnailUrl: asset.thumbnailUrl,
    altText: asset.altText,
    originalName: asset.originalName,
    fileSize: asset.fileSize,
    width: asset.width,
    height: asset.height,
  }
}

function serializeCreative(creative: NonNullable<Advertisement['creatives']>[number]): AdvertisementCreativeDto {
  return {
    id: creative.id,
    mediaAssetId: creative.mediaAssetId,
    format: creative.format,
    mediaAsset: serializeMedia(creative.mediaAsset),
  }
}

export type AdvertisementWithCreator = Advertisement & {
  createdBy?: { id: string; name: string | null; email: string | null } | null
}

export function serializeAdvertisement(advertisement: AdvertisementWithCreator): AdvertisementAdminDTO {
  return {
    id: advertisement.id,
    title: advertisement.title,
    slug: advertisement.slug,
    description: advertisement.description,
    placement: advertisement.placement,
    type: advertisement.type,
    action: advertisement.action,
    buttonVariant: advertisement.buttonVariant,
    desktopMediaId: advertisement.desktopMediaId,
    mobileMediaId: advertisement.mobileMediaId,
    altText: advertisement.altText,
    bannerUrl: advertisement.bannerUrl,
    buttonLabel: advertisement.buttonLabel,
    buttonUrl: advertisement.buttonUrl,
    openInNewTab: advertisement.openInNewTab,
    displayOrder: advertisement.displayOrder,
    priority: advertisement.priority,
    startDate: toISOStringSafe(advertisement.startDate),
    endDate: toISOStringSafe(advertisement.endDate),
    isEnabled: advertisement.isEnabled,
    isArchived: advertisement.isArchived,
    showDesktop: advertisement.showDesktop,
    showTablet: advertisement.showTablet,
    showMobile: advertisement.showMobile,
    createdById: advertisement.createdById,
    updatedById: advertisement.updatedById,
    internalNotes: advertisement.internalNotes,
    isDismissible: advertisement.isDismissible,
    isDeleted: advertisement.isDeleted,
    createdAt: toISOStringSafe(advertisement.createdAt) ?? '',
    updatedAt: toISOStringSafe(advertisement.updatedAt) ?? '',
    desktopMedia: serializeMedia(advertisement.desktopMedia),
    mobileMedia: serializeMedia(advertisement.mobileMedia),
    creatives: advertisement.creatives?.map(serializeCreative) || [],
    createdBy: advertisement.createdBy
      ? { id: advertisement.createdBy.id, name: advertisement.createdBy.name, email: advertisement.createdBy.email }
      : null,
    companyId: advertisement.companyId || null,
    locationTarget: advertisement.locationTarget
      ? {
          locationLabel: advertisement.locationTarget.locationLabel,
          countryCode: advertisement.locationTarget.countryCode,
          city: advertisement.locationTarget.city,
          state: advertisement.locationTarget.state,
          zip: advertisement.locationTarget.zip,
          googlePlaceId: advertisement.locationTarget.googlePlaceId,
          latitude: advertisement.locationTarget.latitude,
          longitude: advertisement.locationTarget.longitude,
          radiusMiles: advertisement.locationTarget.radiusMiles,
        }
      : null,
  }
}

export function serializeAdvertisementList(advertisements: Advertisement[]): AdvertisementAdminDTO[] {
  return advertisements.map(serializeAdvertisement)
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const DATE_ONLY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function formatAdminDate(value: Date | string | null | undefined, withTime = true): string {
  const iso = toISOStringSafe(value)
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return (withTime ? DATE_FORMATTER : DATE_ONLY_FORMATTER).format(date)
}
