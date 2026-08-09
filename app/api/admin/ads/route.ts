/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/currentUser"
import { AdvertisementService } from "@/lib/advertisements/services"
import { CreateAdSchema, AdQuerySchema } from "@/lib/advertisements/validation"
import { serializeAdvertisement, serializeAdvertisementList } from "@/lib/admin/advertisement-dto"

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

    const param = (key: string) => searchParams.get(key) ?? undefined

    const parsed = AdQuerySchema.safeParse({
      page: param("page"),
      limit: param("limit"),
      placement: param("placement"),
      adType: param("adType"),
      isEnabled: param("isEnabled"),
      isArchived: param("isArchived"),
      search: param("search"),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid query parameters", issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const result = await AdvertisementService.list({
      page: parsed.data.page,
      limit: parsed.data.limit,
      placement: parsed.data.placement,
      adType: parsed.data.adType,
      isEnabled: parsed.data.isEnabled === undefined ? undefined : parsed.data.isEnabled === "true",
      isArchived: parsed.data.isArchived === undefined ? undefined : parsed.data.isArchived === "true",
      search: parsed.data.search,
    })

    return NextResponse.json({
      success: true,
      ads: serializeAdvertisementList(result.ads),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    })
  } catch (error) {
    console.error("GET /api/admin/ads error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch advertisements" },
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

    const parsed = CreateAdSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 422 }
      )
    }

    const ad = await AdvertisementService.create({
      ...parsed.data,
      createdById: user.id,
    })

    return NextResponse.json({
      success: true,
      ad: serializeAdvertisement(ad),
    }, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/admin/ads error:", error)
    if (error.message?.includes("not found")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }
    if (error.message?.includes('not compatible') || error.message?.includes('Creative media asset') || error.message?.includes('creative dimensions') || error.message?.includes('too tall') || error.message?.includes('too wide') || error.message?.includes('aspect ratio is') || error.message?.includes('no measurable dimensions')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 })
    }
    if (error.message?.includes("Duplicate slug")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to create advertisement" },
      { status: 500 }
    )
  }
}
