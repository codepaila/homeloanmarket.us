// app/api/admin/brokers/[id]/cover-image/media/route.ts
// Admin-only: apply an existing Media Library asset as the broker cover image.
// The server resolves the canonical asset URL — a client-supplied URL is never
// trusted. The selected asset is NOT re-uploaded or duplicated.
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/currentUser"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getCurrentUser()
    if (admin?.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const broker = await prisma.broker.findUnique({ where: { id }, select: { id: true } })
    if (!broker) {
      return NextResponse.json({ message: "Broker not found" }, { status: 404 })
    }

    let mediaAssetId: unknown
    try {
      const body = await request.json()
      mediaAssetId = body?.mediaAssetId
    } catch {
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 })
    }
    if (typeof mediaAssetId !== "string" || !mediaAssetId) {
      return NextResponse.json({ message: "A media asset ID is required" }, { status: 422 })
    }

    // Resolve the selected media asset server-side and verify it is an allowed
    // image that is not deleted.
    const asset = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } })
    if (!asset || asset.isDeleted) {
      return NextResponse.json({ message: "Media asset not found" }, { status: 404 })
    }
    if (!asset.mimeType || !asset.mimeType.startsWith("image/")) {
      return NextResponse.json({ message: "Only image assets can be used as a cover image" }, { status: 422 })
    }
    if (!asset.fileUrl) {
      return NextResponse.json({ message: "Media asset has no usable file URL" }, { status: 422 })
    }

    // Canonical asset URL is resolved server-side from the stored asset record.
    const coverImage = asset.fileUrl

    // Only the cover assignment changes; profile image, logo, ownership, and
    // subscription state are untouched.
    const updated = await prisma.broker.update({
      where: { id },
      data: { coverImage },
      select: { id: true, coverImage: true, profileImage: true },
    })

    console.info("Admin applied media asset as broker cover", { adminId: admin.id, brokerId: id, mediaAssetId, coverImage })
    return NextResponse.json({ message: "Cover image updated", coverImage: updated.coverImage, profileImage: updated.profileImage })
  } catch (error) {
    console.error("POST /api/admin/brokers/[id]/cover-image/media error:", error)
    return NextResponse.json({ message: "Failed to update cover image" }, { status: 500 })
  }
}