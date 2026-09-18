/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getClientIP } from "@/lib/advertisements/utils"
import { AdvertisementService } from "@/lib/advertisements/services"
import { adImpressionRateLimitExceeded, adImpressionIsDuplicate } from "@/lib/rateLimit"
import prisma from "@/lib/prisma"

// Anonymous tracking metadata is bounded before it is persisted so a caller
// cannot store arbitrary large blobs in the AdEvent collection.
const AD_ID_MAX = 64
const META_MAX = 512
const CLIENT_META_MAX = 100

function boundedString(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.length > 0 ? value.slice(0, max) : undefined
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const { advertisementId, referrer, page } = body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {} as Record<string, unknown>

    // Distributed per-IP rate limit FIRST, before any database work, so abusive
    // callers cannot force ad lookups or event writes. Fails open on Redis
    // outage (ad rendering must never break).
    const ip = getClientIP(request.headers)
    if (await adImpressionRateLimitExceeded(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many requests" },
        { status: 429 },
      )
    }

    if (typeof advertisementId !== "string" || !advertisementId || advertisementId.length > AD_ID_MAX) {
      return NextResponse.json(
        { success: false, error: "advertisementId is required" },
        { status: 400 }
      )
    }

    if (!await AdvertisementService.getPublishableById(advertisementId)) {
      return NextResponse.json(
        { success: false, error: "Advertisement not found" },
        { status: 404 },
      )
    }

    // Distributed dedup gate: one counted impression per (advertisement,
    // client) per short window. Returning before the write keeps repeated
    // beacons from inflating events. The existing database dedup remains as a
    // fallback for the rare case where the distributed gate is unavailable.
    if (await adImpressionIsDuplicate(advertisementId, ip)) {
      return NextResponse.json({ success: true, deduplicated: true })
    }

    const existing = await prisma.adEvent.findFirst({
      where: {
        advertisementId,
        eventType: "IMPRESSION",
        ipAddress: ip,
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    })

    const fiveSecondsAgo = new Date(Date.now() - 5000)
    if (existing && existing.createdAt > fiveSecondsAgo) {
      return NextResponse.json({
        success: true,
        deduplicated: true,
      })
    }

    await AdvertisementService.recordImpression({
      advertisementId,
      ipAddress: ip,
      userAgent: boundedString(request.headers.get("user-agent"), META_MAX),
      referrer: boundedString(referrer ?? request.headers.get("referer"), META_MAX),
      page: boundedString(page ?? request.headers.get("referer"), META_MAX),
      country: boundedString(request.headers.get("x-country"), CLIENT_META_MAX),
      city: boundedString(request.headers.get("x-city"), CLIENT_META_MAX),
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error: any) {
    console.error("POST /api/ads/impression error:", error)
    if (error.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Advertisement not found" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to record impression" },
      { status: 500 }
    )
  }
}
