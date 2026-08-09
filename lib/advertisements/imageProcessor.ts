import sharp from "sharp"
import { writeFile, mkdir, unlink } from "fs/promises"
import path from "path"
import prisma from "@/lib/prisma"
import type { MediaAsset as MediaAssetType } from "@/lib/advertisements/types"
import {
  isImageMime,
  getImageExtension,
  sanitizeFileName,
} from "./utils"

export interface ProcessedImage {
  fileUrl: string
  thumbnailUrl: string | null
  mimeType: string
  extension: string
  width: number
  height: number
  fileSize: number
}

const MEDIA_DIR = path.join(process.cwd(), "public", "uploads", "media")
const UPLOAD_URL_PREFIX = "/uploads/media/"

const THUMBNAIL_WIDTH = 200
const SMALL_WIDTH = 400
const MEDIUM_WIDTH = 800
const LARGE_WIDTH = 1200

export async function validateUpload(file: File): Promise<{
  isValid: boolean
  error?: string
  mimeType?: string
  extension?: string
}> {
  if (!file || !file.size) {
    return { isValid: false, error: "No file provided" }
  }

  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return { isValid: false, error: "Image is too large. Maximum allowed size is 10 MB." }
  }

  // SVG is intentionally rejected for advertisement media: the current storage
  // pipeline stores the original SVG bytes without sanitization (a script/XSS
  // risk) and writes it with a raster filename, so it is not a safe input.
  if (file.type === "image/svg+xml") {
    return { isValid: false, error: "SVG images are not supported for advertisement media. Please upload JPG, PNG, WebP, or GIF." }
  }

  if (!isImageMime(file.type)) {
    return { isValid: false, error: `Unsupported image format: ${file.type}. Please upload JPG, PNG, WebP, or GIF.` }
  }

  return {
    isValid: true,
    mimeType: file.type,
    extension: getImageExtension(file.type),
  }
}

export async function processImage(file: File): Promise<ProcessedImage> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const input = sharp(buffer)

  const metadata = await input.metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0

  if (width === 0 || height === 0) {
    throw new Error("Unable to determine image dimensions")
  }

  const processedBuffer = await input
    .webp({ quality: 85, force: true })
    .toBuffer()
  const outputMimeType = "image/webp"
  const outputExtension = "webp"

  const mediaId = crypto.randomUUID()
  const mainFileName = `${mediaId}.webp`

  await ensureDir(MEDIA_DIR)

  const mainPath = path.join(MEDIA_DIR, mainFileName)
  await writeFile(mainPath, processedBuffer)

  const thumbnailFileName = `${mediaId}@200x200.webp`
  const thumbnailPath = path.join(MEDIA_DIR, thumbnailFileName)

  await input
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_WIDTH, { fit: "cover" })
    .webp({ quality: 80 })
    .toFile(thumbnailPath)

  const fileUrl = `${UPLOAD_URL_PREFIX}${mainFileName}`
  const thumbnailUrl = `${UPLOAD_URL_PREFIX}${thumbnailFileName}`

  return {
    fileUrl,
    thumbnailUrl,
    mimeType: outputMimeType,
    extension: outputExtension,
    width,
    height,
    fileSize: processedBuffer.length,
  }
}

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true })
  } catch {
    // Directory already exists
  }
}

export async function createMediaAsset(data: {
  file: File
  altText: string
  title?: string
  folderId?: string | null
  tags?: string[]
  uploaderId: string
}): Promise<MediaAssetType> {
  const validation = await validateUpload(data.file)
  if (!validation.isValid) {
    throw new Error(validation.error)
  }

  const processed = await processImage(data.file)
  const mainPath = path.join(MEDIA_DIR, path.basename(processed.fileUrl))
  const thumbnailPath = processed.thumbnailUrl ? path.join(MEDIA_DIR, path.basename(processed.thumbnailUrl)) : null

  let mediaAsset: MediaAssetType
  try {
    mediaAsset = await prisma.mediaAsset.create({
      data: {
        fileName: path.basename(processed.fileUrl),
        originalName: data.file.name,
        fileUrl: processed.fileUrl,
        thumbnailUrl: processed.thumbnailUrl,
        mimeType: processed.mimeType,
        extension: processed.extension,
        fileSize: processed.fileSize,
        width: processed.width,
        height: processed.height,
        altText: data.altText,
        title: data.title ?? undefined,
        folder: data.folderId ? { connect: { id: data.folderId } } : undefined,
        uploader: { connect: { id: data.uploaderId } },
        tags: data.tags ?? [],
      },
    })
  } catch (error) {
    // The storage files were written before the database reference. If the
    // database write fails, remove the just-written files so a failed upload
    // never leaves orphaned media on disk.
    try {
      await unlink(mainPath)
    } catch {
      // ignore
    }
    if (thumbnailPath) {
      try {
        await unlink(thumbnailPath)
      } catch {
        // ignore
      }
    }
    throw error
  }

  return mediaAsset
}

export { MEDIA_DIR, UPLOAD_URL_PREFIX }
