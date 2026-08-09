/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/currentUser"
import { AdvertisementService } from "@/lib/advertisements/services"
import { BulkAdActionSchema } from "@/lib/advertisements/validation"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()

    const parsed = BulkAdActionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 422 }
      )
    }

    const { action, ids } = parsed.data

    const processed = await AdvertisementService.bulkAction(
      ids,
      action as "enable" | "disable" | "archive" | "restore" | "delete"
    )

    return NextResponse.json({
      success: true,
      message: `${processed} advertisements ${action}d successfully`,
      processed,
    })
  } catch (error: any) {
    console.error("POST /api/admin/ads/bulk error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to process bulk action" },
      { status: 500 }
    )
  }
}
