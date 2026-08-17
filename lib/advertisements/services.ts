import { AdvertisementRepository, AdEventRepository } from "./advertisementRepository"
import { MediaRepository } from "./mediaRepository"
import type { Advertisement, AdEvent, MediaAsset, MediaFolderWithCount, PaginatedAds, AdminAdsStats, PlacementStat, TopAdvertisementStat, DailyEngagementPoint } from "./types"
import { generateUniqueSlug, normalizeAdvertisementTitle } from "./utils"
import { createMediaAsset } from "./imageProcessor"
import { isSafeAdvertisementUrl } from "./validation"
import { isFormatCompatible, type AdvertisementFormat } from './formats'
import { validateCreativeDimensions } from './placementSpecs'
import prisma from "@/lib/prisma"

export class AdvertisementService {
  static async list(params: {
    page: number
    limit: number
    placement?: string
    adType?: string
    isEnabled?: boolean
    isArchived?: boolean
    search?: string
  }): Promise<PaginatedAds> {
    return AdvertisementRepository.findMany({
      ...params,
      includeTrashed: false,
    })
  }

  static async getById(id: string): Promise<Advertisement | null> {
    return AdvertisementRepository.findById(id)
  }

  static async getBySlug(slug: string): Promise<Advertisement | null> {
    return AdvertisementRepository.findBySlug(slug)
  }

  static async create(data: {
    title?: string | null
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
    companyId?: string | null
    locationTarget?: {
      locationLabel: string
      countryCode: string
      city?: string
      state?: string
      zip?: string
      googlePlaceId?: string
      latitude: number
      longitude: number
      radiusMiles: number
    }
    creativeAssignments?: { mediaAssetId: string; format: AdvertisementFormat }[]
    createdById: string
  }): Promise<Advertisement> {
    const { creativeAssignments = [], ...advertisementData } = data
    if (advertisementData.desktopMediaId === '') advertisementData.desktopMediaId = null
    if (advertisementData.mobileMediaId === '') advertisementData.mobileMediaId = null
    advertisementData.title = normalizeAdvertisementTitle(advertisementData.title as string | null | undefined)
    const slug = await generateUniqueSlug((advertisementData.title as string | null | undefined) || '')

    const existingSlug = await AdvertisementRepository.findBySlug(slug)
    if (existingSlug) {
      throw new Error("Duplicate slug generated, please try again")
    }

    if (data.desktopMediaId) {
      const asset = await MediaRepository.findAsset(data.desktopMediaId)
      if (!asset) throw new Error("Desktop media asset not found")
    }
    if (data.mobileMediaId) {
      const asset = await MediaRepository.findAsset(data.mobileMediaId)
      if (!asset) throw new Error("Mobile media asset not found")
    }

    if (data.locationTarget && (data.locationTarget.countryCode !== 'US' || data.locationTarget.radiusMiles <= 0 || data.locationTarget.radiusMiles > 100)) {
      throw new Error('Invalid US advertisement location target')
    }

    await this.validateCreativeAssignments(data.placement, creativeAssignments)

    const ad = await AdvertisementRepository.create({
      ...advertisementData,
      slug,
      buttonVariant: data.buttonVariant || "PRIMARY",
    })
    await AdvertisementRepository.syncCreatives(ad.id, creativeAssignments)
    return (await this.getById(ad.id)) || ad
  }

  static async update(id: string, data: Record<string, unknown>): Promise<Advertisement> {
    const ad = await this.getById(id)
    if (!ad) throw new Error("Advertisement not found")

    const creativeAssignments = data.creativeAssignments as { mediaAssetId: string; format: AdvertisementFormat }[] | undefined
    const locationTarget = data.locationTarget as {
      locationLabel: string
      countryCode: string
      city?: string
      state?: string
      zip?: string
      googlePlaceId?: string
      latitude: number
      longitude: number
      radiusMiles: number
    } | null | undefined
    const advertisementData = { ...data }
    delete advertisementData.creativeAssignments
    delete advertisementData.locationTarget
    if (advertisementData.desktopMediaId === '') advertisementData.desktopMediaId = null
    if (advertisementData.mobileMediaId === '') advertisementData.mobileMediaId = null
    // Title semantics: omitted → preserve existing; null → clear; "" → clear.
    if ('title' in advertisementData) {
      advertisementData.title = normalizeAdvertisementTitle(advertisementData.title as string | null | undefined)
    }
    if (creativeAssignments !== undefined) await this.validateCreativeAssignments(typeof data.placement === 'string' ? data.placement : ad.placement, creativeAssignments)
    if (locationTarget && (locationTarget.countryCode !== 'US' || locationTarget.radiusMiles <= 0 || locationTarget.radiusMiles > 100)) {
      throw new Error('Invalid US advertisement location target')
    }
    const updated = await AdvertisementRepository.update(id, advertisementData)
    if (creativeAssignments !== undefined) await AdvertisementRepository.syncCreatives(id, creativeAssignments)
    if (locationTarget !== undefined) {
      await prisma.advertisementLocationTarget.deleteMany({ where: { advertisementId: id } })
      if (locationTarget) await prisma.advertisementLocationTarget.create({ data: { advertisementId: id, ...locationTarget } })
    }
    return (await this.getById(updated.id)) || updated
  }

  private static async validateCreativeAssignments(placement: string, assignments: { mediaAssetId: string; format: AdvertisementFormat }[]) {
    if (placement === 'BROKER_LISTING_LOCAL' && !assignments.some((assignment) => assignment.format === 'SQUARE')) {
      throw new Error('BROKER_LISTING_LOCAL advertisements require a SQUARE creative')
    }
    for (const assignment of assignments) {
      if (!isFormatCompatible(placement, assignment.format)) throw new Error(`${assignment.format} creative is not compatible with ${placement}`)
      const asset = await MediaRepository.findAsset(assignment.mediaAssetId)
      if (!asset) throw new Error(`Creative media asset not found: ${assignment.mediaAssetId}`)
      const device = assignment.format === 'MOBILE' ? 'mobile' : 'desktop'
      const result = validateCreativeDimensions(placement, assignment.format, asset.width, asset.height, device)
      if (!result.ok) throw new Error(result.reason)
    }
  }

  static async publish(id: string): Promise<Advertisement> {
    const ad = await this.getById(id)
    if (!ad) throw new Error("Advertisement not found")
    if (!ad.desktopMediaId && !ad.mobileMediaId && !ad.bannerUrl && !ad.creatives?.length) {
      throw new Error("Advertisement requires a creative asset or banner URL")
    }
    if ((ad.bannerUrl && !isSafeAdvertisementUrl(ad.bannerUrl)) || (ad.buttonUrl && !isSafeAdvertisementUrl(ad.buttonUrl))) {
      throw new Error("Advertisement contains an unsafe destination URL")
    }
    return AdvertisementRepository.publish(id)
  }

  static async unpublish(id: string): Promise<Advertisement> {
    const ad = await this.getById(id)
    if (!ad) throw new Error("Advertisement not found")
    return AdvertisementRepository.unpublish(id)
  }

  static async archive(id: string): Promise<Advertisement> {
    const ad = await this.getById(id)
    if (!ad) throw new Error("Advertisement not found")
    return AdvertisementRepository.archive(id)
  }

  static async restore(id: string): Promise<Advertisement> {
    const ad = await prisma.advertisement.findUnique({ where: { id } })
    if (!ad) {
      throw new Error("Advertisement not found")
    }
    return AdvertisementRepository.restore(id)
  }

  static async findDeletedById(id: string): Promise<Advertisement | null> {
    const ad = await AdvertisementRepository.findMany({
      page: 1,
      limit: 1,
      search: id,
      includeTrashed: true,
    })
    return ad.ads[0] || null
  }

  static async delete(id: string): Promise<void> {
    const ad = await this.getById(id)
    if (!ad) throw new Error("Advertisement not found")
    await AdvertisementRepository.softDelete(id)
  }

  static async hardDelete(id: string): Promise<void> {
    const ad = await prisma.advertisement.findUnique({ where: { id, isDeleted: true } })
    if (!ad) throw new Error("Advertisement not found")
    await AdvertisementRepository.hardDelete(id)
  }

  static async duplicate(
    id: string,
    data: {
      title?: string
      placement?: string
      createdById: string
      copyImages?: boolean
      copySchedule?: boolean
      copyPriority?: boolean
      copyButtonSettings?: boolean
      copyStatus?: boolean
      generateNewSlug?: boolean
    }
  ): Promise<Advertisement> {
    const ad = await this.getById(id)
    if (!ad) throw new Error("Advertisement not found")

    // The destination placement is the override if provided, else the original.
    const placement = data.placement || ad.placement
    const assignments = (ad.creatives || []).map((creative) => ({ mediaAssetId: creative.mediaAssetId, format: creative.format as AdvertisementFormat }))
    // Duplicated creatives must satisfy the same canonical contract as any
    // create/update: format compatibility, exact dimensions, and the
    // BROKER_LISTING_LOCAL SQUARE requirement. Never silently copy an invalid
    // or legacy-incompatible creative into a live duplicate.
    await this.validateCreativeAssignments(placement, assignments)

    const copy = await AdvertisementRepository.duplicate(id, {
      ...data,
      placement,
      title: data.title,
    })
    if (assignments.length) {
      await AdvertisementRepository.syncCreatives(copy.id, assignments)
    }
    return (await this.getById(copy.id)) || copy
  }

  static async bulkAction(
    ids: string[],
    action: "enable" | "disable" | "archive" | "restore" | "delete"
  ): Promise<number> {
    const data: {
      isEnabled?: boolean
      isArchived?: boolean
      isDeleted?: boolean
    } = {}

    switch (action) {
      case "enable":
        data.isEnabled = true
        break
      case "disable":
        data.isEnabled = false
        break
      case "archive":
        data.isArchived = true
        data.isEnabled = false
        break
      case "restore":
        data.isArchived = false
        break
      case "delete":
        data.isDeleted = true
        data.isEnabled = false
        data.isArchived = true
        break
    }

    return AdvertisementRepository.bulkUpdate(ids, data)
  }

  static async findActiveAds(
    placement: string,
    device: "desktop" | "tablet" | "mobile",
    limit: number = 1,
    now: Date = new Date(),
    location?: { latitude: number; longitude: number },
  ) {
    return AdvertisementRepository.findActiveByPlacement(placement, device, limit, now, location)
  }

  static async getPublishableById(id: string) {
    return AdvertisementRepository.findPublishableById(id)
  }

  static async recordImpression(params: {
    advertisementId: string
    ipAddress?: string
    userAgent?: string
    referrer?: string
    page?: string
    country?: string
    city?: string
    userId?: string
  }): Promise<AdEvent> {
    return AdEventRepository.create({
      ...params,
      eventType: "IMPRESSION",
    })
  }

  static async recordClick(params: {
    advertisementId: string
    ipAddress?: string
    userAgent?: string
    referrer?: string
    page?: string
    country?: string
    city?: string
    userId?: string
  }): Promise<AdEvent> {
    return AdEventRepository.create({
      ...params,
      eventType: "CLICK",
    })
  }

  static async getStats(advertisementId: string): Promise<{ impressions: number; clicks: number }> {
    return AdEventRepository.countByAdvertisement(advertisementId)
  }

  static async getDashboardStats(): Promise<AdminAdsStats> {
    const now = new Date()
    const since14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const [total, published, draft, archived, scheduled, expired, totalMediaAssets, totalFolders, recentAds, recentUploads, impressionCount, clickCount, placementGroups, allTimeEventGroups, recentEvents] =
      await Promise.all([
        prisma.advertisement.count({ where: { isDeleted: false } }),
        prisma.advertisement.count({ where: { isEnabled: true, isArchived: false, isDeleted: false } }),
        prisma.advertisement.count({ where: { isEnabled: false, isArchived: false, isDeleted: false } }),
        prisma.advertisement.count({ where: { isArchived: true } }),
        prisma.advertisement.count({
          where: {
            startDate: { gt: now },
            isEnabled: false,
            isArchived: false,
            isDeleted: false,
          },
        }),
        prisma.advertisement.count({
          where: {
            endDate: { lt: now },
            isEnabled: true,
            isArchived: false,
            isDeleted: false,
          },
        }),
        prisma.mediaAsset.count({ where: { isDeleted: false } }),
        prisma.mediaFolder.count({ where: { isDeleted: false } }),
        prisma.advertisement.findMany({
          where: { isDeleted: false },
          include: { desktopMedia: true, mobileMedia: true, createdBy: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.mediaAsset.findMany({
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.adEvent.count({ where: { eventType: "IMPRESSION" } }),
        prisma.adEvent.count({ where: { eventType: "CLICK" } }),
        prisma.advertisement.groupBy({ by: ["placement"], _count: { _all: true } }),
        prisma.adEvent.groupBy({ by: ["advertisementId", "eventType"], _count: { _all: true } }),
        prisma.adEvent.findMany({
          where: { createdAt: { gte: since14 } },
          select: { eventType: true, createdAt: true },
        }),
      ])

    const ctr = impressionCount > 0 ? Number(((clickCount / impressionCount) * 100).toFixed(2)) : null

    const placementStats: PlacementStat[] = placementGroups
      .map((group) => ({ placement: group.placement, count: group._count._all }))
      .sort((a, b) => b.count - a.count)

    const ads = await prisma.advertisement.findMany({ where: { isDeleted: false }, select: { id: true, title: true, placement: true } })
    const countsByAd = new Map<string, { impressions: number; clicks: number }>()
    for (const group of allTimeEventGroups) {
      const current = countsByAd.get(group.advertisementId) || { impressions: 0, clicks: 0 }
      if (group.eventType === "IMPRESSION") current.impressions += group._count._all
      if (group.eventType === "CLICK") current.clicks += group._count._all
      countsByAd.set(group.advertisementId, current)
    }
    const topAds: TopAdvertisementStat[] = ads
      .map((ad) => {
        const counts = countsByAd.get(ad.id) || { impressions: 0, clicks: 0 }
        return {
          id: ad.id,
          title: ad.title || 'Untitled',
          placement: ad.placement,
          impressions: counts.impressions,
          clicks: counts.clicks,
          ctr: counts.impressions > 0 ? Number(((counts.clicks / counts.impressions) * 100).toFixed(2)) : null,
        }
      })
      .filter((ad) => ad.impressions > 0 || ad.clicks > 0)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5)

    const dailyEngagement: DailyEngagementPoint[] = []
    const cursor = new Date(since14)
    cursor.setUTCHours(0, 0, 0, 0)
    const dayImpressions = new Map<string, number>()
    const dayClicks = new Map<string, number>()
    for (const event of recentEvents) {
      const key = event.createdAt.toISOString().slice(0, 10)
      if (event.eventType === "IMPRESSION") dayImpressions.set(key, (dayImpressions.get(key) || 0) + 1)
      if (event.eventType === "CLICK") dayClicks.set(key, (dayClicks.get(key) || 0) + 1)
    }
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    while (cursor <= todayStart) {
      const key = cursor.toISOString().slice(0, 10)
      dailyEngagement.push({ date: key, impressions: dayImpressions.get(key) || 0, clicks: dayClicks.get(key) || 0 })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    return {
      total,
      published,
      draft,
      archived,
      scheduled,
      expired,
      totalMediaAssets,
      totalFolders,
      recentAds: recentAds,
      recentUploads: recentUploads,
      impressions: impressionCount,
      clicks: clickCount,
      ctr,
      placementStats,
      topAds,
      dailyEngagement,
    }
  }
}

export class MediaService {
  static async listFolders(): Promise<MediaFolderWithCount[]> {
    return MediaRepository.findFolders()
  }

  static async getFolderTree(): Promise<MediaFolderWithCount[]> {
    return MediaRepository.findFolderTree()
  }

  static async createFolder(data: { name: string; parentId?: string | null }): Promise<MediaFolderWithCount> {
    return MediaRepository.createFolder(data)
  }

  static async updateFolder(id: string, data: { name: string }): Promise<MediaFolderWithCount> {
    const folder = await MediaRepository.findFolders()
    const exists = folder.find(f => f.id === id)
    if (!exists) throw new Error("Folder not found")
    return MediaRepository.updateFolder(id, data)
  }

  static async deleteFolder(id: string): Promise<void> {
    const folder = await MediaRepository.findFolders()
    const exists = folder.find(f => f.id === id)
    if (!exists) throw new Error("Folder not found")
    await MediaRepository.deleteFolder(id)
  }

  static async listAssets(params: {
    page: number
    limit: number
    search?: string
    folderId?: string
  }): Promise<{ assets: MediaAsset[]; total: number }> {
    return MediaRepository.findAssets(params)
  }

  static async getAsset(id: string): Promise<MediaAsset | null> {
    return MediaRepository.findAsset(id)
  }

  static async getAssetByUrl(fileUrl: string): Promise<MediaAsset | null> {
    return MediaRepository.findAssetByUrl(fileUrl)
  }

  static async upload(data: {
    file: File
    altText: string
    title?: string
    description?: string
    folderId?: string | null
    tags?: string[]
    uploaderId: string
  }): Promise<MediaAsset> {
    return createMediaAsset(data)
  }

  static async updateAsset(id: string, data: { title?: string; altText?: string }): Promise<MediaAsset> {
    const asset = await MediaRepository.findAsset(id)
    if (!asset) throw new Error("Asset not found")
    return MediaRepository.renameAsset(id, data)
  }

  static async moveAsset(id: string, folderId: string | null): Promise<MediaAsset> {
    const asset = await MediaRepository.findAsset(id)
    if (!asset) throw new Error("Asset not found")
    return MediaRepository.moveAsset(id, folderId)
  }

  static async deleteAsset(id: string): Promise<void> {
    const asset = await MediaRepository.findAsset(id)
    if (!asset) throw new Error("Asset not found")
    await MediaRepository.softDeleteAsset(id)
  }

  static async restoreAsset(id: string): Promise<MediaAsset> {
    const assets = await MediaRepository.findDeletedAssets({ page: 1, limit: 1, search: id })
    if (!assets.assets.length) throw new Error("Asset not found")
    return MediaRepository.restoreAsset(id)
  }

  static async hardDeleteAsset(id: string): Promise<void> {
    const assets = await MediaRepository.findDeletedAssets({ page: 1, limit: 1, search: id })
    if (!assets.assets.length) throw new Error("Asset not found")
    await MediaRepository.hardDeleteAsset(id)
  }
}
