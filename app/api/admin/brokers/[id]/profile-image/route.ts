// app/api/admin/brokers/[id]/profile-image/route.ts
// Admin-only profile image upload/removal for a specific broker.
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/currentUser"
import { uploadBrokerProfileImage, ProfileImageValidationError } from "@/lib/broker-profile-image"

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

    const url = await uploadBrokerProfileImage(rawFile as File)

    const updated = await prisma.broker.update({
      where: { id },
      data: { profileImage: url },
      select: { id: true, profileImage: true },
    })

    return NextResponse.json({ message: "Profile image updated", profileImage: updated.profileImage })
  } catch (error) {
    if (error instanceof ProfileImageValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }
    console.error("POST /api/admin/brokers/[id]/profile-image error:", error)
    return NextResponse.json({ message: "Failed to upload profile image" }, { status: 500 })
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
      data: { profileImage: null },
      select: { id: true, profileImage: true },
    })

    return NextResponse.json({ message: "Profile image removed", profileImage: updated.profileImage })
  } catch (error) {
    console.error("DELETE /api/admin/brokers/[id]/profile-image error:", error)
    return NextResponse.json({ message: "Failed to remove profile image" }, { status: 500 })
  }
}
