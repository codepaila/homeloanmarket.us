// Generic authenticated image upload endpoint.
//
// The browser sends the raw file here (multipart/form-data) together with a
// validated `type`. We upload local-first, then fall back to authenticated
// Cloudinary, and return only the resulting image URL. This endpoint never
// writes to the database — the existing profile/registration endpoints persist
// the returned URL with their own ownership checks.
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/currentUser"
import { uploadImage, ImageUploadError } from "@/lib/image-upload"

type UploadType = "logo" | "cover" | "avatar"

const TYPE_CONFIG: Record<UploadType, { category: string; cloudinaryFolder: string }> = {
  logo: { category: "brokers/logo", cloudinaryFolder: "homeloanmarket/brokers/logo" },
  cover: { category: "brokers/cover", cloudinaryFolder: "homeloanmarket/brokers/cover" },
  avatar: { category: "users/avatar", cloudinaryFolder: "homeloanmarket/users/avatar" },
}

const BROKER_ONLY_TYPES: UploadType[] = ["logo", "cover"]

function isUploadType(value: unknown): value is UploadType {
  return typeof value === "string" && value in TYPE_CONFIG
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 })
    }

    const formData = await request.formData()
    const type = formData.get("type")

    if (!isUploadType(type)) {
      return NextResponse.json({ message: "Invalid image type" }, { status: 400 })
    }

    // Broker logo/cover are broker-scoped; avatars are open to any authenticated
    // user (the User.image write itself is enforced separately by /api/user/profile).
    if (BROKER_ONLY_TYPES.includes(type) && user.role !== "BROKER") {
      return NextResponse.json({ message: "Only brokers can upload this image type" }, { status: 403 })
    }

    const rawFile = formData.get("file")
    if (!rawFile || typeof rawFile === "string") {
      return NextResponse.json({ message: "No image file provided" }, { status: 400 })
    }

    const config = TYPE_CONFIG[type]
    const url = await uploadImage({
      file: rawFile as File,
      category: config.category,
      cloudinaryFolder: config.cloudinaryFolder,
    })

    return NextResponse.json({ url })
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }
    console.error("POST /api/upload/image error:", error)
    return NextResponse.json({ message: "Image upload failed. Please try again." }, { status: 500 })
  }
}
