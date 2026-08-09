/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/currentUser"
import { MediaService } from "@/lib/advertisements/services"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()

    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Folder name is required" },
        { status: 400 }
      )
    }

    const { id } = await params
    const folder = await MediaService.updateFolder(id, {
      name: body.name.trim(),
    })

    return NextResponse.json({
      success: true,
      folder,
    })
  } catch (error: any) {
    console.error("PUT /api/admin/media/folders/[id] error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update folder" },
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
    await MediaService.deleteFolder(id)

    return NextResponse.json({
      success: true,
      message: "Folder deleted successfully",
    })
  } catch (error: any) {
    console.error("DELETE /api/admin/media/folders/[id] error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete folder" },
      { status: 500 }
    )
  }
}
