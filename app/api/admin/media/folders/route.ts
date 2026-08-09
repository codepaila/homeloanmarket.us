/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/currentUser"
import { MediaService } from "@/lib/advertisements/services"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const tree = await MediaService.getFolderTree()

    return NextResponse.json({
      success: true,
      folders: tree,
    })
  } catch (error) {
    console.error("GET /api/admin/media/folders error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch folders" },
      { status: 500 }
    )
  }
}

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

    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Folder name is required" },
        { status: 400 }
      )
    }

    const folder = await MediaService.createFolder({
      name: body.name.trim(),
      parentId: body.parentId || null,
    })

    return NextResponse.json({
      success: true,
      folder,
    }, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/admin/media/folders error:", error)
    if (error.message === "Parent folder not found") {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to create folder" },
      { status: 500 }
    )
  }
}
