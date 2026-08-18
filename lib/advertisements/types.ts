import type { Prisma } from "@prisma/client"
import type { AdvertisementFormat } from './formats'

export type MediaFolderWithCount = {
  id: string
  name: string
  path: string
  parentId: string | null
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
  _count?: { assets: number }
}

export type MediaAsset = {
  id: string
  title: string | null
  fileName: string
  originalName: string
  fileUrl: string
  thumbnailUrl: string | null
  mimeType: string
  extension: string
  fileSize: number
  width: number | null
  height: number | null
  altText: string | null
  tags: string[]
  folderId: string | null
  uploaderId: string
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

export type Advertisement = {
  id: string
  title: string | null
  slug: string
  description: string | null
  placement: string
  type: string
  action: string
  buttonVariant: string
  desktopMediaId: string | null
  mobileMediaId: string | null
  desktopMedia?: MediaAsset | null
  mobileMedia?: MediaAsset | null
  creatives?: AdvertisementCreative[]
  altText: string | null
  bannerUrl: string | null
  buttonLabel: string | null
  buttonUrl: string | null
  openInNewTab: boolean
  displayOrder: number
  priority: number
  startDate: Date | null
  endDate: Date | null
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
  createdAt: Date
  updatedAt: Date
  companyId?: string | null
  locationTarget?: {
    id: string
    advertisementId: string
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

export type AdvertisementCreative = {
  id: string
  advertisementId: string
  mediaAssetId: string
  format: AdvertisementFormat
  mediaAsset?: MediaAsset | null
  createdAt: Date
  updatedAt: Date
}

export type AdEvent = {
  id: string
  advertisementId: string
  eventType: string
  ipAddress: string | null
  userAgent: string | null
  referrer: string | null
  page: string | null
  country: string | null
  city: string | null
  createdAt: Date
}

export type AdvertisementWithMedia = Omit<Prisma.AdvertisementGetPayload<{
  include: {
    desktopMedia: true
    mobileMedia: true
  }
}>, "desktopMedia" | "mobileMedia"> & {
  desktopMedia: MediaAsset | null
  mobileMedia: MediaAsset | null
}

export type PublicAdResponse = {
  id: string
  title: string | null
  description: string | null
  type: string
  action: string
  buttonVariant: string
  placement: string
  altText: string | null
  bannerUrl: string | null
  buttonLabel: string | null
  buttonUrl: string | null
  openInNewTab: boolean
  isDismissible: boolean
  startDate: string | null
  endDate: string | null
  creativeFormat: AdvertisementFormat | null
  creative?: {
    fileUrl: string
    thumbnailUrl: string | null
    altText: string | null
    width: number | null
    height: number | null
  } | null
  desktopMedia: {
    fileUrl: string
    thumbnailUrl: string | null
    altText: string | null
    width: number | null
    height: number | null
  } | null
  mobileMedia: {
    fileUrl: string
    thumbnailUrl: string | null
    altText: string | null
    width: number | null
    height: number | null
  } | null
}

export type PublicAdsResponse = {
  success: boolean
  ads: PublicAdResponse[]
  message?: string
}

export type PaginatedAds = {
  ads: Advertisement[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type DeviceType = "desktop" | "tablet" | "mobile"

export type PlacementStat = {
  placement: string
  count: number
}

export type TopAdvertisementStat = {
  id: string
  title: string
  placement: string
  impressions: number
  clicks: number
  ctr: number | null
}

export type DailyEngagementPoint = {
  date: string
  impressions: number
  clicks: number
}

export type AdminAdsStats = {
  total: number
  published: number
  draft: number
  archived: number
  scheduled: number
  expired: number
  totalMediaAssets: number
  totalFolders: number
  recentAds: Advertisement[]
  recentUploads: MediaAsset[]
  impressions: number
  clicks: number
  ctr: number | null
  placementStats: PlacementStat[]
  topAds: TopAdvertisementStat[]
  dailyEngagement: DailyEngagementPoint[]
}

// Ownership contract for advertisement creation. Company ownership is OPTIONAL
// for direct admin creation (platform ads) but REQUIRED/DERIVED when creating
// from a CompanyAdRequest. This is the single shared type used by the wizard,
// the owner selector, the edit form, and the API.
export type AdvertisementOwner =
  | { type: 'PLATFORM'; companyId: null }
  | { type: 'COMPANY'; companyId: string }

// Server-derived context when creating an advertisement from a company request.
// The company is locked to the request's company and the request relationship
// is managed server-side (never trusted from the client).
export type AdvertisementRequestContext = {
  requestId: string
  companyId: string
  locked: true
}
