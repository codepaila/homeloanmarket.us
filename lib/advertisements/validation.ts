import { z } from "zod"
import { AdvertisementPlacement, AdType, AdvertisementAction, ButtonVariant } from "@prisma/client"
import { ADVERTISEMENT_FORMATS } from './formats'

export function isSafeAdvertisementUrl(value: string): boolean {
  if (value.startsWith("#") || value.startsWith("?")) return true
  if (value.startsWith("/")) return !value.startsWith("//")
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

const safeAdvertisementUrl = z.string().refine(isSafeAdvertisementUrl, "Must be a safe HTTP(S) or relative URL")

export const CreateMediaFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(100),
  parentId: z.string().optional(),
})

export const UpdateMediaFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(100),
})

export const UploadMediaSchema = z.object({
  altText: z.string().min(1, "Alt text is required").max(200),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  folderId: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const UpdateMediaSchema = z.object({
  title: z.string().max(200).optional(),
  altText: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  folderId: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const MediaQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  folderId: z.string().optional(),
})

const CreateAdBaseSchema = z.object({
  title: z.string().max(200).nullish(),
  slug: z.string().optional(),
  description: z.string().max(1000).optional(),
  placement: z.nativeEnum(AdvertisementPlacement),
  type: z.nativeEnum(AdType),
  action: z.nativeEnum(AdvertisementAction),
  buttonVariant: z.nativeEnum(ButtonVariant).optional(),
  desktopMediaId: z.string().optional(),
  mobileMediaId: z.string().optional(),
  altText: z.string().max(200).optional(),
  bannerUrl: safeAdvertisementUrl.optional(),
  buttonLabel: z.string().max(50).optional(),
  buttonUrl: safeAdvertisementUrl.optional(),
  openInNewTab: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).default(0),
  priority: z.coerce.number().int().min(1).max(100).default(10),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isEnabled: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  showDesktop: z.boolean().optional(),
  showTablet: z.boolean().optional(),
  showMobile: z.boolean().optional(),
  internalNotes: z.string().max(500).optional(),
  isDismissible: z.boolean().optional(),
  creativeAssignments: z.array(z.object({
    mediaAssetId: z.string().min(1),
    format: z.enum(ADVERTISEMENT_FORMATS),
  })).max(5).optional(),
  locationTarget: z.object({
    locationLabel: z.string().min(1).max(200),
    countryCode: z.literal('US'),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    zip: z.string().max(20).optional(),
    googlePlaceId: z.string().max(200).optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMiles: z.number().positive().max(100),
  }).optional(),
  companyId: z.string().optional(),
  requestId: z.string().optional(),
})

function validateAdDates(data: { startDate?: Date; endDate?: Date; creativeAssignments?: { format: string }[] }, context: z.RefinementCtx) {
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after start date" })
  }
  if (data.creativeAssignments && new Set(data.creativeAssignments.map((creative) => creative.format)).size !== data.creativeAssignments.length) {
    context.addIssue({ code: "custom", path: ["creativeAssignments"], message: "Each creative format may only be assigned once." })
  }
}

export const CreateAdSchema = CreateAdBaseSchema.superRefine(validateAdDates)

export const UpdateAdSchema = CreateAdBaseSchema.partial().superRefine(validateAdDates)

export const AdQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
  placement: z.nativeEnum(AdvertisementPlacement).optional(),
  adType: z.nativeEnum(AdType).optional(),
  isEnabled: z.enum(["true", "false"]).optional(),
  isArchived: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
})

export const BulkAdActionSchema = z.object({
  action: z.enum(["enable", "disable", "archive", "restore", "delete"]),
  ids: z.array(z.string()).min(1, "At least one ad ID required"),
})

export const ImpressionSchema = z.object({
  advertisementId: z.string(),
  positionKey: z.string().optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  userAgent: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  referrer: z.string().optional(),
  page: z.string().optional(),
})

export const ClickSchema = z.object({
  advertisementId: z.string(),
  positionKey: z.string().optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  userAgent: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  referrer: z.string().optional(),
  page: z.string().optional(),
})

export type CreateMediaFolderInput = z.infer<typeof CreateMediaFolderSchema>
export type UpdateMediaFolderInput = z.infer<typeof UpdateMediaFolderSchema>
export type UploadMediaInput = z.infer<typeof UploadMediaSchema>
export type UpdateMediaInput = z.infer<typeof UpdateMediaSchema>
export type MediaQueryInput = z.infer<typeof MediaQuerySchema>
export type CreateAdInput = z.infer<typeof CreateAdSchema>
export type UpdateAdInput = z.infer<typeof UpdateAdSchema>
export type AdQueryInput = z.infer<typeof AdQuerySchema>
export type BulkAdActionInput = z.infer<typeof BulkAdActionSchema>
export type ImpressionInput = z.infer<typeof ImpressionSchema>
export type ClickInput = z.infer<typeof ClickSchema>
