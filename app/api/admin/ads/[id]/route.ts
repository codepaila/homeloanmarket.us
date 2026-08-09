/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/currentUser"
import { AdvertisementService } from "@/lib/advertisements/services"
import { UpdateAdSchema } from "@/lib/advertisements/validation"
import { serializeAdvertisement } from "@/lib/admin/advertisement-dto"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const ad = await AdvertisementService.getById(id)

    if (!ad) {
      return NextResponse.json(
        { success: false, error: "Advertisement not found" },
        { status: 404 }
      )
    }

    const stats = await AdvertisementService.getStats(ad.id)

    return NextResponse.json({
      success: true,
      ad: serializeAdvertisement(ad),
      metrics: stats,
    })
  } catch (error) {
    console.error("GET /api/admin/ads/[id] error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch advertisement" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const parsed = UpdateAdSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 422 }
      )
    }

    const ad = await AdvertisementService.update(id, parsed.data as Record<string, unknown>)

    return NextResponse.json({
      success: true,
      ad: serializeAdvertisement(ad),
    })
  } catch (error: any) {
    console.error("PUT /api/admin/ads/[id] error:", error)
    if (error.message === "Advertisement not found") {
      return NextResponse.json(
        { success: false, error: "Advertisement not found" },
        { status: 404 }
      )
    }
    if (error.message?.includes('not compatible') || error.message?.includes('Creative media asset') || error.message?.includes('creative dimensions') || error.message?.includes('too tall') || error.message?.includes('too wide') || error.message?.includes('aspect ratio is') || error.message?.includes('no measurable dimensions')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 })
    }
    return NextResponse.json(
      { success: false, error: "Failed to update advertisement" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    await AdvertisementService.delete(id)

    return NextResponse.json({
      success: true,
      message: "Advertisement archived successfully",
    })
  } catch (error: any) {
    console.error("DELETE /api/admin/ads/[id] error:", error)
    if (error.message === "Advertisement not found") {
      return NextResponse.json(
        { success: false, error: "Advertisement not found" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to delete advertisement" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const action = body.action

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Action is required" },
        { status: 400 }
      )
    }

    switch (action) {
      case "publish": {
        const ad = await AdvertisementService.publish(id)
        return NextResponse.json({ success: true, ad: serializeAdvertisement(ad) })
      }

      case "unpublish": {
        const ad = await AdvertisementService.unpublish(id)
        return NextResponse.json({ success: true, ad: serializeAdvertisement(ad) })
      }

      case "archive": {
        const ad = await AdvertisementService.archive(id)
        return NextResponse.json({ success: true, ad: serializeAdvertisement(ad) })
      }

      case "restore": {
        const ad = await AdvertisementService.restore(id)
        return NextResponse.json({ success: true, ad: serializeAdvertisement(ad) })
      }

      case "duplicate": {
        const ad = await AdvertisementService.duplicate(id, {
          title: body.title,
          placement: body.placement,
          createdById: user.id,
        })
        return NextResponse.json({ success: true, ad }, { status: 201 })
      }

      case "hard_delete": {
        await AdvertisementService.hardDelete(id)
        return NextResponse.json(
          { success: true, message: "Advertisement permanently deleted" }
        )
      }

      case "preview": {
        const ad = await AdvertisementService.getById(id)
        if (!ad) {
          return NextResponse.json(
            { success: false, error: "Advertisement not found" },
            { status: 404 }
          )
        }
        const device = body.device || "desktop"
        return NextResponse.json({
          success: true,
          ad: serializeAdvertisement(ad),
          preview: {
            device,
            url: `/preview/ad/${ad.slug}?device=${device}`,
          },
        })
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error("POST /api/admin/ads/[id] error:", error)
    if (error.message === "Advertisement not found") {
      return NextResponse.json(
        { success: false, error: "Advertisement not found" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to process action" },
      { status: 500 }
    )
  }
}
