import { NextRequest, NextResponse } from "next/server"
import { getDeviceType } from "@/lib/advertisements/utils"
import { AdvertisementService } from "@/lib/advertisements/services"
import { PLACEMENT_KEY_MAP, PLACEMENT_ENUM_VALUES } from "@/lib/advertisements/public"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const positionKey = searchParams.get("position") || searchParams.get("placement")
    const limitParam = parseInt(searchParams.get("limit") || "1")
    const limit = Math.min(Math.max(limitParam, 1), 10)

    if (!positionKey) {
      return NextResponse.json(
        { success: false, error: "position or placement parameter is required" },
        { status: 400 }
      )
    }

    const placement = PLACEMENT_KEY_MAP[positionKey] || positionKey

    if (!PLACEMENT_ENUM_VALUES.includes(placement as typeof PLACEMENT_ENUM_VALUES[number])) {
      return NextResponse.json(
        { success: false, error: `Invalid placement: ${positionKey}` },
        { status: 400 }
      )
    }

    const device = getDeviceType(request.headers)

    const ads = await AdvertisementService.findActiveAds(
      placement,
      device === "mobile" ? "mobile" : device === "tablet" ? "tablet" : "desktop",
      limit
    )

    if (ads.length === 0) {
      return NextResponse.json({
        success: true,
        ads: [],
        message: "No active advertisements for this position",
      })
    }

    return NextResponse.json({
      success: true,
      ads: ads,
    })
  } catch (error) {
    console.error("GET /api/ads/public error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch advertisements" },
      { status: 500 }
    )
  }
}
