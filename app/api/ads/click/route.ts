/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getClientIP } from "@/lib/advertisements/utils"
import { AdvertisementService } from "@/lib/advertisements/services"
import { isSafeAdvertisementUrl } from "@/lib/advertisements/validation"
import { adClickRateLimitExceeded } from "@/lib/rateLimit"

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

    // Distributed per-IP rate limit FIRST, before any database work. Clicks are
    // a discrete user action, so — consistent with existing behavior — each
    // accepted click is recorded; the rate limit is the defined abuse policy
    // (impressions use the additional dedup gate).
    const ip = getClientIP(request.headers)
    if (await adClickRateLimitExceeded(ip)) {
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

    const ad = await AdvertisementService.getPublishableById(advertisementId)
    if (!ad) {
      return NextResponse.json(
        { success: false, error: "Advertisement not found" },
        { status: 404 },
      )
    }

    await AdvertisementService.recordClick({
      advertisementId,
      ipAddress: ip,
      userAgent: boundedString(request.headers.get("user-agent"), META_MAX),
      referrer: boundedString(referrer ?? request.headers.get("referer"), META_MAX),
      page: boundedString(page ?? request.headers.get("referer"), META_MAX),
      country: boundedString(request.headers.get("x-country"), CLIENT_META_MAX),
      city: boundedString(request.headers.get("x-city"), CLIENT_META_MAX),
    })

    const redirectUrl = [ad.buttonUrl, ad.bannerUrl].find(
      (value): value is string => Boolean(value && isSafeAdvertisementUrl(value)),
    ) || "/"

    return NextResponse.json({
      success: true,
      redirectUrl,
    })
  } catch (error: any) {
    console.error("POST /api/ads/click error:", error)
    if (error.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Advertisement not found" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to record click" },
      { status: 500 }
    )
  }
}
