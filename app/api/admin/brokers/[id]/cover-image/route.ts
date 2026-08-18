// app/api/admin/brokers/[id]/cover-image/route.ts
// Admin-only cover image upload/removal for a specific broker. Mirrors the
// profile-image route and reuses the shared server-side upload pipeline.
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/currentUser"
import { uploadBrokerCoverImage, CoverImageValidationError } from "@/lib/broker-cover-image"

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

    const formData = await request.formData()
    const rawFile = formData.get("file")
    if (!rawFile || typeof rawFile === "string") {
      return NextResponse.json({ message: "No image file provided" }, { status: 400 })
    }

    const url = await uploadBrokerCoverImage(rawFile as File)

    // Only the cover assignment changes; profile image/logo/ownership are untouched.
    const updated = await prisma.broker.update({
      where: { id },
      data: { coverImage: url },
      select: { id: true, coverImage: true, profileImage: true },
    })

    return NextResponse.json({ message: "Cover image updated", coverImage: updated.coverImage, profileImage: updated.profileImage })
  } catch (error) {
    if (error instanceof CoverImageValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }
    console.error("POST /api/admin/brokers/[id]/cover-image error:", error)
    return NextResponse.json({ message: "Failed to upload cover image" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
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

    const updated = await prisma.broker.update({
      where: { id },
      data: { coverImage: null },
      select: { id: true, coverImage: true, profileImage: true },
    })

    return NextResponse.json({ message: "Cover image removed", coverImage: updated.coverImage, profileImage: updated.profileImage })
  } catch (error) {
    console.error("DELETE /api/admin/brokers/[id]/cover-image error:", error)
    return NextResponse.json({ message: "Failed to remove cover image" }, { status: 500 })
  }
}
