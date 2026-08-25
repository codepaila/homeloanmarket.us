// app/api/brokers/me/cover-image/route.ts
// Broker self-service cover image upload/removal. The broker record is always
// derived from the authenticated user's relationship — an arbitrary brokerId is
// never accepted from the browser, so a broker can only ever modify their own
// cover image. Reuses the shared server-side upload pipeline (MIME + size +
// real-image validation, safe filenames, path-traversal guard).
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/currentUser"
import { uploadBrokerCoverImage, CoverImageValidationError } from "@/lib/broker-cover-image"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 })
    }
    if (user.role !== "BROKER") {
      return NextResponse.json({ message: "Only brokers can upload a cover image" }, { status: 403 })
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

    const url = await uploadBrokerCoverImage(rawFile as File)

    const updated = await prisma.broker.update({
      where: { id: broker.id },
      data: { coverImage: url },
      select: { id: true, coverImage: true, profileImage: true },
    })

    return NextResponse.json({ message: "Cover image updated", coverImage: updated.coverImage, profileImage: updated.profileImage })
  } catch (error) {
    if (error instanceof CoverImageValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }
    console.error("POST /api/brokers/me/cover-image error:", error)
    return NextResponse.json({ message: "Failed to upload cover image" }, { status: 500 })
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
      data: { coverImage: null },
      select: { id: true, coverImage: true, profileImage: true },
    })

    return NextResponse.json({ message: "Cover image removed", coverImage: updated.coverImage, profileImage: updated.profileImage })
  } catch (error) {
    console.error("DELETE /api/brokers/me/cover-image error:", error)
    return NextResponse.json({ message: "Failed to remove cover image" }, { status: 500 })
  }
}