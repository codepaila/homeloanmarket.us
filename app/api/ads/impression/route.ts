/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getClientIP } from "@/lib/advertisements/utils"
import { AdvertisementService } from "@/lib/advertisements/services"
import prisma from "@/lib/prisma"

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

    if (!await AdvertisementService.getPublishableById(advertisementId)) {
      return NextResponse.json(
        { success: false, error: "Advertisement not found" },
        { status: 404 },
      )
    }

    const ip = getClientIP(request.headers)
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
      userAgent: request.headers.get("user-agent") || undefined,
      referrer: referrer || request.headers.get("referer") || undefined,
      page: page || request.headers.get("referer") || undefined,
      country: request.headers.get("x-country") || undefined,
      city: request.headers.get("x-city") || undefined,
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
