/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/currentUser"
import { MediaService } from "@/lib/advertisements/services"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    const asset = await MediaService.getAsset(id)

    if (!asset) {
      return NextResponse.json(
        { success: false, error: "Asset not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      asset,
    })
  } catch (error) {
    console.error("GET /api/admin/media/[id] error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch media asset" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()

    const asset = await MediaService.updateAsset(id, {
      title: body.title,
      altText: body.altText,
    })

    return NextResponse.json({
      success: true,
      asset,
    })
  } catch (error: any) {
    console.error("PUT /api/admin/media/[id] error:", error)
    if (error.message === "Asset not found") {
      return NextResponse.json(
        { success: false, error: "Asset not found" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to update media asset" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    await MediaService.deleteAsset(id)

    return NextResponse.json({
      success: true,
      message: "Asset soft deleted successfully",
    })
  } catch (error: any) {
    console.error("DELETE /api/admin/media/[id] error:", error)
    if (error.message === "Asset not found") {
      return NextResponse.json(
        { success: false, error: "Asset not found" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to delete asset" },
      { status: 500 }
    )
  }
}
