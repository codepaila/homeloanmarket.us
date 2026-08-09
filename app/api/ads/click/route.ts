/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getClientIP } from "@/lib/advertisements/utils"
import { AdvertisementService } from "@/lib/advertisements/services"
import { isSafeAdvertisementUrl } from "@/lib/advertisements/validation"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { advertisementId, referrer, page } = body

    if (!advertisementId) {
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

    const ip = getClientIP(request.headers)

    await AdvertisementService.recordClick({
      advertisementId,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || undefined,
      referrer: referrer || request.headers.get("referer") || undefined,
      page: page || request.headers.get("referer") || undefined,
      country: request.headers.get("x-country") || undefined,
      city: request.headers.get("x-city") || undefined,
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
