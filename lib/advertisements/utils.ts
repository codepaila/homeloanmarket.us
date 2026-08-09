import prisma from "@/lib/prisma"
import type { DeviceType } from "../advertisements/types"

export function slug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = slug(title)

  if (!baseSlug) {
    const randomSlug = `ad-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
    const exists = await prisma.advertisement.findUnique({ where: { slug: randomSlug } })
    return exists ? `${randomSlug}-${Math.random().toString(36).substring(2, 6)}` : randomSlug
  }

  const existing = await prisma.advertisement.findUnique({
    where: { slug: baseSlug },
    select: { slug: true },
  })

  if (!existing) {
    return baseSlug
  }

  const uniqueSlug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`
  return uniqueSlug
}

export function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function generateFileName(originalName: string, mediaId: string): string {
  const ext = originalName.split(".").pop()?.toLowerCase() || "webp"
  const sanitized = sanitizeFileName(originalName.replace(/\.[^/.]+$/, ""))
  return `${mediaId}-${sanitized}.${ext}`
}

export function isImageMime(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"].includes(mimeType)
}

export function getImageExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
  }
  return map[mimeType] || "unknown"
}

export function getDeviceType(headers: Headers): DeviceType {
  const ua = headers.get("user-agent") || ""
  const isMobile = /Mobile|Android|iP(hone|od)/i.test(ua)

  if (isMobile) return "mobile"

  const isTablet = /Tablet|iPad/i.test(ua)
  if (isTablet) return "tablet"

  return "desktop"
}

export function getClientIP(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()

  const realIp = headers.get("x-real-ip")
  if (realIp) return realIp

  return "unknown"
}

export function getPublicUrl(fileUrl: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  if (!baseUrl) return fileUrl
  if (fileUrl.startsWith("http")) return fileUrl
  return `${baseUrl}${fileUrl}`
}

export function isDateWithinRange(startDate: Date | null | undefined, endDate: Date | null | undefined, now: Date = new Date()): boolean {
  if (startDate && now < startDate) return false
  if (endDate && now > endDate) return false
  return true
}
