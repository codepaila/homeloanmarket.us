// Broker cover image upload — thin wrapper over the shared image-upload
// service (lib/image-upload.ts), identical in architecture to the profile
// image wrapper. Local-first, then authenticated Cloudinary fallback. The cover
// is an optional wide header image for the public broker detail page; it is
// cropped to fit via object-cover, so only MIME + size are validated (no exact
// pixel requirement), consistent with the profile image.

import { uploadImage, validateImageFile, ImageUploadError } from "./image-upload"
import type { ImageUploadDeps } from "./image-upload"

const COVER_CATEGORY = "brokers/cover"
const COVER_CLOUDINARY_FOLDER = "homeloanmarket/brokers/cover"
const COVER_MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const COVER_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]

export { ImageUploadError as CoverImageValidationError }

export function validateCoverImage(file: File): void {
  validateImageFile(file, {
    maxSize: COVER_MAX_SIZE,
    allowedMimeTypes: COVER_ALLOWED_MIME_TYPES,
  })
}

export async function uploadBrokerCoverImage(
  file: File,
  deps: ImageUploadDeps = {},
): Promise<string> {
  return uploadImage(
    {
      file,
      category: COVER_CATEGORY,
      cloudinaryFolder: COVER_CLOUDINARY_FOLDER,
      maxSize: COVER_MAX_SIZE,
      allowedMimeTypes: COVER_ALLOWED_MIME_TYPES,
    },
    deps,
  )
}
