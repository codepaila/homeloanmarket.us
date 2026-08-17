// Shared server-side image upload.
//
// Local-first storage with an authenticated Cloudinary fallback. This is the
// single reusable upload primitive used by broker profile images, broker
// logos/covers, and user avatars. The browser always sends the file to our
// server (never directly to Cloudinary via an unsigned preset).
//
// NOTE ON PRODUCTION DURABILITY: local storage under `public/` is inherently
// ephemeral on serverless hosts (e.g. Vercel). Local-first is preserved for
// local development / self-hosted Node, and the authenticated Cloudinary
// fallback is what persists uploads in those environments. We never silently
// report success when both providers failed.

import { writeFile, mkdir } from "fs/promises"
import path from "path"
import crypto from "crypto"
import sharp from "sharp"
import { uploadImageToCloudinary } from "./cloudinary"

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads")
const URL_PREFIX = "/uploads/"

export const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 // 5 MB
export const DEFAULT_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export class ImageUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ImageUploadError"
  }
}

export type ImageUploadOptions = {
  file: File
  /** Local sub-directory + URL path under /uploads, e.g. "brokers/logo". */
  category: string
  /** Cloudinary folder, e.g. "homeloanmarket/brokers/logo". */
  cloudinaryFolder: string
  maxSize?: number
  allowedMimeTypes?: string[]
}

// Optional dependencies exposed for testing. Production callers always use the
// default (real) implementation.
export type ImageUploadDeps = {
  processImage?: (file: File) => Promise<Buffer>
  storeLocally?: (processed: Buffer) => Promise<string>
  uploadToCloudinary?: (processed: Buffer) => Promise<string | null>
}

export function validateImageFile(
  file: File,
  options: { maxSize?: number; allowedMimeTypes?: string[] } = {},
): void {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE
  const allowed = options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES

  if (!file || !file.size) {
    throw new ImageUploadError("No image file provided")
  }
  if (!allowed.includes(file.type)) {
    throw new ImageUploadError("Unsupported image format.")
  }
  if (file.size > maxSize) {
    throw new ImageUploadError(`Image is too large. Maximum allowed size is ${Math.round(maxSize / 1024 / 1024)} MB.`)
  }
}

// Re-encode to WebP once: validates the payload is a real image (sharp throws
// on unsupported input), strips metadata, auto-orients, and normalizes output.
async function processImageFile(file: File): Promise<Buffer> {
  const buffer = Buffer.from(await file.arrayBuffer())
  return sharp(buffer).rotate().webp({ quality: 85 }).toBuffer()
}

// The category is always supplied by server-side code (never raw client
// input). This guard is defense-in-depth against path traversal.
function assertSafeCategory(category: string): string {
  if (!/^[a-z0-9][a-z0-9/_-]*$/.test(category)) {
    throw new ImageUploadError("Invalid upload category")
  }
  return category
}

async function writeLocalFile(processed: Buffer, category: string): Promise<string> {
  const safeCategory = assertSafeCategory(category)
  const fileName = `${crypto.randomUUID()}.webp`
  const dir = path.join(UPLOAD_ROOT, safeCategory)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, fileName), processed)
  return `${URL_PREFIX}${safeCategory}/${fileName}`
}

async function uploadToCloudinaryDefault(processed: Buffer, folder: string): Promise<string | null> {
  const result = await uploadImageToCloudinary(processed, { folder })
  return result?.secureUrl ?? null
}

export async function uploadImage(
  options: ImageUploadOptions,
  deps: ImageUploadDeps = {},
): Promise<string> {
  validateImageFile(options.file, options)

  const processImage = deps.processImage ?? processImageFile
  const store = deps.storeLocally ?? ((processed: Buffer) => writeLocalFile(processed, options.category))
  const uploadCloudinary = deps.uploadToCloudinary ?? ((processed: Buffer) => uploadToCloudinaryDefault(processed, options.cloudinaryFolder))

  let processed: Buffer
  try {
    processed = await processImage(options.file)
  } catch {
    throw new ImageUploadError("Uploaded file is not a valid image.")
  }

  // 1. Local-first.
  try {
    return await store(processed)
  } catch (localError) {
    console.error(
      "[image-upload] local storage failed, falling back to Cloudinary",
      localError instanceof Error ? localError.message : String(localError),
    )
  }

  // 2. Cloudinary fallback (authenticated server-side upload).
  const cloudinaryUrl = await uploadCloudinary(processed)
  if (cloudinaryUrl) return cloudinaryUrl

  throw new ImageUploadError("Image upload failed. Please try again.")
}
