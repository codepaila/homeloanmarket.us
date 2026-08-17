// Broker profile image upload — thin wrapper over the shared image-upload
// service (lib/image-upload.ts). Keeps the profile image behavior identical to
// before (local-first, then authenticated Cloudinary fallback) while sharing
// the common upload implementation.

import { uploadImage, validateImageFile, ImageUploadError } from "./image-upload"
import type { ImageUploadDeps } from "./image-upload"

const PROFILE_CATEGORY = "brokers/profile"
const PROFILE_CLOUDINARY_FOLDER = "homeloanmarket/brokers/profile"
const PROFILE_MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const PROFILE_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]

export { ImageUploadError as ProfileImageValidationError }
export type ProfileImageUploadDeps = ImageUploadDeps

export function validateProfileImage(file: File): void {
  validateImageFile(file, {
    maxSize: PROFILE_MAX_SIZE,
    allowedMimeTypes: PROFILE_ALLOWED_MIME_TYPES,
  })
}

export async function uploadBrokerProfileImage(
  file: File,
  deps: ProfileImageUploadDeps = {},
): Promise<string> {
  return uploadImage(
    {
      file,
      category: PROFILE_CATEGORY,
      cloudinaryFolder: PROFILE_CLOUDINARY_FOLDER,
      maxSize: PROFILE_MAX_SIZE,
      allowedMimeTypes: PROFILE_ALLOWED_MIME_TYPES,
    },
    deps,
  )
}
