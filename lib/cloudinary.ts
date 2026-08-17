// Server-only Cloudinary utility.
//
// IMPORTANT: never import this module from a client component. It reads the
// Cloudinary API secret (server environment only) and performs authenticated
// server-side uploads. The API secret must never be bundled into the browser.
//
// It exposes a single small, reusable upload primitive so upload-related code
// (e.g. broker profile images) can rely on a centralized, authenticated
// Cloudinary path instead of unsigned browser uploads or duplicated logic.

import crypto from "crypto"

export type CloudinaryUploadResult = {
  secureUrl: string
  publicId?: string
}

export type CloudinaryUploadOptions = {
  /** Cloudinary folder path (e.g. "homeloanmarket/brokers/profile"). */
  folder?: string
  /** Collision-safe public id. Defaults to a generated UUID when omitted. */
  publicId?: string
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  )
}

/**
 * Authenticated server-side upload of an image buffer to Cloudinary.
 *
 * Returns the secure HTTPS URL (and public id) on success, or `null` when
 * Cloudinary is not configured or the upload fails. This never throws so
 * callers can treat it purely as a fallback and surface their own safe error.
 */
export async function uploadImageToCloudinary(
  buffer: Buffer,
  options: CloudinaryUploadOptions = {},
): Promise<CloudinaryUploadResult | null> {
  if (!isCloudinaryConfigured()) return null

  try {
    // Lazily imported so the Cloudinary SDK (and credentials) are only ever
    // pulled into server-side bundles.
    const { v2: cloudinary } = await import("cloudinary")
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    })

    const result = await new Promise<{ secure_url?: string; public_id?: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          public_id: options.publicId ?? crypto.randomUUID(),
          resource_type: "image",
          overwrite: false,
        },
        (error: unknown, res: { secure_url?: string; public_id?: string } | undefined) => {
          if (error) reject(error)
          else resolve(res ?? {})
        },
      )
      stream.end(buffer)
    })

    if (!result?.secure_url) return null
    return { secureUrl: result.secure_url, publicId: result.public_id }
  } catch (error) {
    console.error(
      "[cloudinary] server upload failed",
      error instanceof Error ? error.message : String(error),
    )
    return null
  }
}
