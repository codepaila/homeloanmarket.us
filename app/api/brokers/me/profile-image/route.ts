// app/api/brokers/me/profile-image/route.ts
// Broker self-service profile image upload/removal. The broker record is
// always derived from the authenticated user's relationship — an arbitrary
// brokerId is never accepted from the browser.
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/currentUser"
import { uploadBrokerProfileImage, ProfileImageValidationError } from "@/lib/broker-profile-image"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 })
    }
    if (user.role !== "BROKER") {
      return NextResponse.json({ message: "Only brokers can upload a profile image" }, { status: 403 })
    }

    const broker = await prisma.broker.findFirst({ where: { userId: user.id } })
    if (!broker) {
      return NextResponse.json({ message: "Broker profile not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const rawFile = formData.get("file")
    if (!rawFile || typeof rawFile === "string") {
      return NextResponse.json({ message: "No image file provided" }, { status: 400 })
    }

    const url = await uploadBrokerProfileImage(rawFile as File)

    const updated = await prisma.broker.update({
      where: { id: broker.id },
      data: { profileImage: url },
      select: { id: true, profileImage: true },
    })

    return NextResponse.json({ message: "Profile image updated", profileImage: updated.profileImage })
  } catch (error) {
    if (error instanceof ProfileImageValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }
    console.error("POST /api/brokers/me/profile-image error:", error)
    return NextResponse.json({ message: "Failed to upload profile image" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 })
    }
    if (user.role !== "BROKER") {
      return NextResponse.json({ message: "Only brokers can update their profile" }, { status: 403 })
    }

    const broker = await prisma.broker.findFirst({ where: { userId: user.id } })
    if (!broker) {
      return NextResponse.json({ message: "Broker profile not found" }, { status: 404 })
    }

    const updated = await prisma.broker.update({
      where: { id: broker.id },
      data: { profileImage: null },
      select: { id: true, profileImage: true },
    })

    return NextResponse.json({ message: "Profile image removed", profileImage: updated.profileImage })
  } catch (error) {
    console.error("DELETE /api/brokers/me/profile-image error:", error)
    return NextResponse.json({ message: "Failed to remove profile image" }, { status: 500 })
  }
}
