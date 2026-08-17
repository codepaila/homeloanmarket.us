import prisma from "@/lib/prisma"
import type { Advertisement, AdEvent, PublicAdResponse, DeviceType, PaginatedAds } from "./types"
import type { AdvertisementFormat } from './formats'
import { Prisma, AdvertisementPlacement, AdType, AdvertisementAction, ButtonVariant, EventType, AdvertisementFormat as PrismaAdvertisementFormat } from '@prisma/client'
import { resolveAdvertisementCreative } from './creativeResolver'
import { normalizeAdvertisementTitle } from './utils'

export class AdvertisementRepository {
  static async findMany(params: {
    page: number
    limit: number
    placement?: string
    adType?: string
    isEnabled?: boolean
    isArchived?: boolean
    search?: string
    includeTrashed?: boolean
  }): Promise<PaginatedAds> {
    const { page, limit, placement, adType, isEnabled, isArchived, search, includeTrashed } = params
    const skip = (page - 1) * limit

    const where: Prisma.AdvertisementWhereInput = {}

    if (!includeTrashed) {
      where.isDeleted = false
    }

    if (placement) {
      where.placement = placement as AdvertisementPlacement
    }

    if (adType) {
      where.type = adType as AdType
    }

    if (isEnabled !== undefined) {
      where.isEnabled = isEnabled
    }

    if (isArchived !== undefined) {
      where.isArchived = isArchived
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { internalNotes: { contains: search, mode: "insensitive" } },
      ]
    }

    const [ads, total] = await Promise.all([
      prisma.advertisement.findMany({
        where,
        include: {
          desktopMedia: true,
          mobileMedia: true,
          creatives: { include: { mediaAsset: true } },
          locationTarget: true,
        },
        skip,
        take: limit,
        orderBy: [
          { priority: "asc" },
          { displayOrder: "asc" },
          { createdAt: "desc" },
        ],
      }),
      prisma.advertisement.count({ where }),
    ])

    return {
      ads: ads as unknown as Advertisement[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  static async findById(id: string): Promise<Advertisement | null> {
    const ad = await prisma.advertisement.findUnique({
      where: { id, isDeleted: false },
      include: {
        desktopMedia: true,
        mobileMedia: true,
        creatives: { include: { mediaAsset: true } },
        locationTarget: true,
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    })
    if (!ad) return null
    return ad as unknown as Advertisement
  }

  static async findBySlug(slug: string): Promise<Advertisement | null> {
    const ad = await prisma.advertisement.findUnique({
      where: { slug, isDeleted: false },
      include: {
        desktopMedia: true,
        mobileMedia: true,
        creatives: { include: { mediaAsset: true } },
        locationTarget: true,
      },
    })
    if (!ad) return null
    return ad as unknown as Advertisement
  }

  static async create(data: {
    title?: string | null
    slug: string
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
   createdById: string
  }): Promise<Advertisement> {
    const ad = await prisma.advertisement.create({
      data: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        placement: data.placement as AdvertisementPlacement,
        type: data.type as AdType,
        action: data.action as AdvertisementAction,
        buttonVariant: (data.buttonVariant || "PRIMARY") as ButtonVariant,
        desktopMediaId: data.desktopMediaId ?? undefined,
        mobileMediaId: data.mobileMediaId ?? undefined,
        altText: data.altText,
        bannerUrl: data.bannerUrl,
        buttonLabel: data.buttonLabel,
        buttonUrl: data.buttonUrl,
        openInNewTab: data.openInNewTab ?? true,
        displayOrder: data.displayOrder ?? 0,
        priority: data.priority ?? 10,
        startDate: data.startDate,
        endDate: data.endDate,
        isEnabled: data.isEnabled ?? false,
        showDesktop: data.showDesktop ?? true,
        showTablet: data.showTablet ?? true,
        showMobile: data.showMobile ?? true,
        internalNotes: data.internalNotes,
        isDismissible: data.isDismissible ?? false,
        createdById: data.createdById,
        updatedById: data.createdById,
        companyId: data.companyId ?? undefined,
        ...(data.locationTarget ? { locationTarget: { create: data.locationTarget } } : {}),
      },
      include: {
        desktopMedia: true,
        mobileMedia: true,
        creatives: { include: { mediaAsset: true } },
        locationTarget: true,
        company: true,
      },
    })
    return ad as unknown as Advertisement
  }

  static async update(id: string, data: Record<string, unknown>): Promise<Advertisement> {
    const ad = await prisma.advertisement.update({
      where: { id, isDeleted: false },
      data,
      include: {
        desktopMedia: true,
        mobileMedia: true,
        creatives: { include: { mediaAsset: true } },
      },
    })
    return ad as unknown as Advertisement
  }

  static async syncCreatives(id: string, assignments: { mediaAssetId: string; format: AdvertisementFormat }[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.advertisementCreative.deleteMany({ where: { advertisementId: id } })
      if (assignments.length > 0) {
        await tx.advertisementCreative.createMany({
          data: assignments.map((assignment) => ({ advertisementId: id, mediaAssetId: assignment.mediaAssetId, format: assignment.format as PrismaAdvertisementFormat })),
        })
      }
    })
  }

  static async publish(id: string): Promise<Advertisement> {
    const ad = await prisma.advertisement.update({
      where: { id, isDeleted: false },
      data: {
        isEnabled: true,
        isArchived: false,
        updatedAt: new Date(),
      },
      include: {
        desktopMedia: true,
        mobileMedia: true,
      },
    })
    return ad as unknown as Advertisement
  }

  static async unpublish(id: string): Promise<Advertisement> {
    const ad = await prisma.advertisement.update({
      where: { id, isDeleted: false },
      data: {
        isEnabled: false,
        updatedAt: new Date(),
      },
      include: {
        desktopMedia: true,
        mobileMedia: true,
      },
    })
    return ad as unknown as Advertisement
  }

  static async archive(id: string): Promise<Advertisement> {
    const ad = await prisma.advertisement.update({
      where: { id, isDeleted: false },
      data: {
        isArchived: true,
        isEnabled: false,
        updatedAt: new Date(),
      },
      include: {
        desktopMedia: true,
        mobileMedia: true,
      },
    })
    return ad as unknown as Advertisement
  }

  static async restore(id: string): Promise<Advertisement> {
    const ad = await prisma.advertisement.update({
      where: { id },
      data: {
        isDeleted: false,
        isArchived: false,
        isEnabled: false,
        updatedAt: new Date(),
      },
      include: {
        desktopMedia: true,
        mobileMedia: true,
      },
    })
    return ad as unknown as Advertisement
  }

  static async softDelete(id: string): Promise<void> {
    await prisma.advertisement.update({
      where: { id, isDeleted: false },
      data: { isDeleted: true },
    })
  }

  static async hardDelete(id: string): Promise<void> {
    await prisma.advertisement.delete({
      where: { id },
    })
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
    const original = await this.findById(id)
    if (!original) throw new Error("Advertisement not found")

    const copyImages = data.copyImages !== false
    const copySchedule = data.copySchedule === true
    const copyPriority = data.copyPriority !== false
    const copyButtonSettings = data.copyButtonSettings !== false
    const copyStatus = data.copyStatus === true

    // Explicit new title wins. An omitted title falls back to "original (Copy)"
    // for titled ads and stays null for untitled ads.
    const copyTitle = data.title !== undefined
      ? normalizeAdvertisementTitle(data.title)
      : normalizeAdvertisementTitle(original.title ? `${original.title} (Copy)` : null)

    // Always a fresh, unique slug. Derived from the copy title by default, or
    // from the original slug when generateNewSlug is disabled.
    const baseSlug = data.generateNewSlug === false
      ? `${original.slug}-copy`
      : ((copyTitle || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `${original.slug}-copy`)
    let slug = `${baseSlug}-${Date.now().toString(36)}`
    let collision = 1
    while (await prisma.advertisement.findUnique({ where: { slug }, select: { slug: true } })) {
      slug = `${baseSlug}-${Date.now().toString(36)}-${collision++}`
    }

    const ad = await prisma.advertisement.create({
      data: {
        title: copyTitle,
        slug,
        description: original.description,
        placement: (data.placement || original.placement) as AdvertisementPlacement,
        type: original.type as AdType,
        action: original.action as AdvertisementAction,
        buttonVariant: copyButtonSettings ? (original.buttonVariant as ButtonVariant) : undefined,
        desktopMediaId: copyImages ? original.desktopMediaId : undefined,
        mobileMediaId: copyImages ? original.mobileMediaId : undefined,
        altText: original.altText,
        bannerUrl: copyImages ? original.bannerUrl : undefined,
        buttonLabel: copyButtonSettings ? original.buttonLabel : undefined,
        buttonUrl: copyButtonSettings ? original.buttonUrl : undefined,
        openInNewTab: copyButtonSettings ? original.openInNewTab : undefined,
        displayOrder: copyPriority ? original.displayOrder : 0,
        priority: copyPriority ? original.priority : 10,
        startDate: copySchedule ? original.startDate : undefined,
        endDate: copySchedule ? original.endDate : undefined,
        isEnabled: copyStatus ? original.isEnabled : false,
        isArchived: copyStatus ? original.isArchived : false,
        showDesktop: original.showDesktop,
        showTablet: original.showTablet,
        showMobile: original.showMobile,
        internalNotes: original.internalNotes,
        isDismissible: original.isDismissible,
        ...(original.locationTarget ? {
          locationTarget: {
            create: {
              locationLabel: original.locationTarget.locationLabel,
              countryCode: original.locationTarget.countryCode,
              city: original.locationTarget.city,
              state: original.locationTarget.state,
              zip: original.locationTarget.zip,
              googlePlaceId: original.locationTarget.googlePlaceId,
              latitude: original.locationTarget.latitude,
              longitude: original.locationTarget.longitude,
              radiusMiles: original.locationTarget.radiusMiles,
            },
          },
        } : {}),
        companyId: original.companyId ?? undefined,
        createdById: data.createdById,
        updatedById: data.createdById,
      },
      include: {
        desktopMedia: true,
        mobileMedia: true,
        locationTarget: true,
        company: true,
      },
    })
    return ad as unknown as Advertisement
  }

  static async findActiveByPlacement(
    placement: string,
    device: DeviceType,
    limit: number = 1,
    now: Date = new Date(),
    location?: { latitude: number; longitude: number },
  ): Promise<PublicAdResponse[]> {
    const where: Prisma.AdvertisementWhereInput = {
      isEnabled: true,
      isArchived: false,
      isDeleted: false,
      placement: placement as AdvertisementPlacement,
      OR: [
        { bannerUrl: { not: null } },
        { desktopMedia: { isDeleted: false } },
        { mobileMedia: { isDeleted: false } },
        { creatives: { some: { mediaAsset: { isDeleted: false } } } },
      ],
    }

    if (device === "desktop") {
      where.showDesktop = true
    } else if (device === "tablet") {
      where.showTablet = true
    } else {
      where.showMobile = true
    }

    const ads = await prisma.advertisement.findMany({
      where,
      include: {
        desktopMedia: { where: { isDeleted: false }, select: { fileUrl: true, thumbnailUrl: true, altText: true, width: true, height: true } },
        mobileMedia: { where: { isDeleted: false }, select: { fileUrl: true, thumbnailUrl: true, altText: true, width: true, height: true } },
        creatives: {
          where: { mediaAsset: { isDeleted: false } },
          include: { mediaAsset: { select: { fileUrl: true, thumbnailUrl: true, altText: true, width: true, height: true } } },
        },
        locationTarget: true,
      },
      take: 100,
      orderBy: [
        { priority: "asc" },
        { displayOrder: "asc" },
        { createdAt: "desc" },
      ],
    })

    const distanceMiles = (latitude: number, longitude: number, targetLatitude: number, targetLongitude: number) => {
      const radians = (value: number) => value * Math.PI / 180
      const deltaLat = radians(targetLatitude - latitude)
      const deltaLng = radians(targetLongitude - longitude)
      const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(targetLatitude)) * Math.sin(deltaLng / 2) ** 2
      return 3958.7613 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    return ads
      .filter((ad) => {
        if (ad.startDate && ad.startDate > now) return false
        if (ad.endDate && ad.endDate < now) return false
        if (placement === 'BROKER_LISTING_LOCAL') {
          if (!location || !ad.locationTarget || ad.locationTarget.countryCode !== 'US') return false
          if (!ad.creatives.some((creative) => creative.format === 'SQUARE')) return false
          return distanceMiles(location.latitude, location.longitude, ad.locationTarget.latitude, ad.locationTarget.longitude) <= ad.locationTarget.radiusMiles
        }
        return true
      })
      .slice(0, limit)
      .map(ad => {
      const resolved = resolveAdvertisementCreative({
        placement: ad.placement,
        device,
        creatives: ad.creatives.map((creative) => ({ format: creative.format as AdvertisementFormat, mediaAsset: creative.mediaAsset })),
        desktopMedia: ad.desktopMedia,
        mobileMedia: ad.mobileMedia,
        bannerUrl: ad.bannerUrl,
        altText: ad.altText,
      })
      return {
       id: ad.id,
       title: ad.title,
       description: ad.description ?? null,
      type: ad.type,
      action: ad.action,
      buttonVariant: ad.buttonVariant,
      placement: ad.placement,
      altText: ad.altText ?? null,
      bannerUrl: ad.bannerUrl ?? null,
      buttonLabel: ad.buttonLabel ?? null,
      buttonUrl: ad.buttonUrl ?? null,
      openInNewTab: ad.openInNewTab,
       isDismissible: ad.isDismissible,
       startDate: ad.startDate?.toISOString() ?? null,
       endDate: ad.endDate?.toISOString() ?? null,
       creativeFormat: resolved.format,
       creative: resolved.media,
      desktopMedia: ad.desktopMedia ? {
        fileUrl: ad.desktopMedia.fileUrl,
        thumbnailUrl: ad.desktopMedia.thumbnailUrl,
        altText: ad.desktopMedia.altText,
        width: ad.desktopMedia.width,
        height: ad.desktopMedia.height,
      } : null,
       mobileMedia: ad.mobileMedia ? {
        fileUrl: ad.mobileMedia.fileUrl,
        thumbnailUrl: ad.mobileMedia.thumbnailUrl,
        altText: ad.mobileMedia.altText,
        width: ad.mobileMedia.width,
        height: ad.mobileMedia.height,
       } : null,
      }
      })
  }

  static async findPublishableById(id: string, now: Date = new Date()) {
    const ad = await prisma.advertisement.findFirst({
      where: {
        id,
        isEnabled: true,
        isArchived: false,
        isDeleted: false,
      },
      select: { buttonUrl: true, bannerUrl: true, placement: true, startDate: true, endDate: true },
    })
    if (!ad || (ad.startDate && ad.startDate > now) || (ad.endDate && ad.endDate < now)) return null
    return ad
  }

  static async bulkUpdate(ids: string[], data: {
    isEnabled?: boolean
    isArchived?: boolean
    isDeleted?: boolean
  }): Promise<number> {
    const result = await prisma.advertisement.updateMany({
      where: { id: { in: ids } },
      data,
    })
    return result.count
  }

  static async findDeleted(params: {
    page: number
    limit: number
    search?: string
  }): Promise<PaginatedAds> {
    const { page, limit, search } = params
    const skip = (page - 1) * limit

    const where: Prisma.AdvertisementWhereInput = { isDeleted: true }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ]
    }

    const [ads, total] = await Promise.all([
      prisma.advertisement.findMany({
        where,
        include: { desktopMedia: true, mobileMedia: true },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.advertisement.count({ where }),
    ])

    return {
      ads: ads as unknown as Advertisement[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }
}

export class AdEventRepository {
  static async create(data: {
    advertisementId: string
    eventType: "IMPRESSION" | "CLICK"
    ipAddress?: string
    userAgent?: string
    referrer?: string
    page?: string
    country?: string
    city?: string
  }): Promise<AdEvent> {
    const event = await prisma.adEvent.create({
      data: {
        advertisementId: data.advertisementId,
        eventType: data.eventType as EventType,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        referrer: data.referrer,
        page: data.page,
        country: data.country,
        city: data.city,
      },
    })
    return event as unknown as AdEvent
  }

  static async countByAdvertisement(advertisementId: string): Promise<{
    impressions: number
    clicks: number
  }> {
    const [impressions, clicks] = await Promise.all([
      prisma.adEvent.count({
        where: { advertisementId, eventType: "IMPRESSION" },
      }),
      prisma.adEvent.count({
        where: { advertisementId, eventType: "CLICK" },
      }),
    ])

    return { impressions, clicks }
  }

  static async getStats(params: {
    advertisementId?: string
    startDate?: Date
    endDate?: Date
  }): Promise<{ impressions: number; clicks: number }> {
    const where: Prisma.AdEventWhereInput = {}

    if (params.advertisementId) {
      where.advertisementId = params.advertisementId
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {}
      if (params.startDate) where.createdAt.gte = params.startDate
      if (params.endDate) where.createdAt.lte = params.endDate
    }

    const [impressions, clicks] = await Promise.all([
      prisma.adEvent.count({ where: { ...where, eventType: "IMPRESSION" } }),
      prisma.adEvent.count({ where: { ...where, eventType: "CLICK" } }),
    ])

    return { impressions, clicks }
  }
}
