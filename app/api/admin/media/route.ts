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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const search = searchParams.get("search") || undefined
    const folderId = searchParams.get("folderId") || undefined

    const result = await MediaService.listAssets({ page, limit, search, folderId })

    return NextResponse.json({
      success: true,
      assets: result.assets,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    })
  } catch (error) {
    console.error("GET /api/admin/media error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch media assets" },
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

    const formData = await request.formData()
    const file = formData.get("file") as File
    const altText = formData.get("altText") as string
    const title = formData.get("title") as string | undefined
    const folderId = formData.get("folderId") as string | undefined
    const tags = formData.get("tags") ? JSON.parse(formData.get("tags") as string) : undefined

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      )
    }

    if (!altText) {
      return NextResponse.json(
        { success: false, error: "Alt text is required" },
        { status: 400 }
      )
    }

    const asset = await MediaService.upload({
      file,
      altText,
      title: title || undefined,
      folderId: folderId || null,
      tags,
      uploaderId: user.id,
    })

    return NextResponse.json({
      success: true,
      asset,
    }, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/admin/media error:", error)
    if (error.message?.includes("size") || error.message?.includes("type") || error.message?.includes("SVG")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }
    if (error instanceof Error && /input buffer|unsupported image format|not a valid image|metadata|dimension/i.test(error.message)) {
      return NextResponse.json(
        { success: false, error: "Uploaded file is not a valid image." },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to upload media" },
      { status: 500 }
    )
  }
}
