import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

// Serves uploaded advertisement media from the local storage directory.
// Next.js static serving only knows public/ files that existed at build time,
// so runtime-uploaded files must be streamed through a route handler instead.
const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads')

const MIME_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const segments = (await params).path
    if (!segments?.length) {
      return new NextResponse('Not Found', { status: 404 })
    }
    // Path traversal guard: only allow plain filename segments inside uploads.
    if (segments.some((segment) => segment.includes('..') || segment.includes('\0') || segment.includes('/'))) {
      return new NextResponse('Not Found', { status: 404 })
    }

    const filePath = path.join(UPLOADS_ROOT, ...segments)
    if (!filePath.startsWith(UPLOADS_ROOT)) {
      return new NextResponse('Not Found', { status: 404 })
    }

    const buffer = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_BY_EXT[ext] || 'application/octet-stream'

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Not Found', { status: 404 })
  }
}
