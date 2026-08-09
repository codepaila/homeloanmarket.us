import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/currentUser"
import { AdvertisementService } from "@/lib/advertisements/services"
import { serializeAdvertisement } from "@/lib/admin/advertisement-dto"

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const stats = await AdvertisementService.getDashboardStats()

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        recentAds: stats.recentAds.map((ad) => serializeAdvertisement(ad)),
      },
    })
  } catch (error) {
    console.error("GET /api/admin/ads/stats error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    )
  }
}
