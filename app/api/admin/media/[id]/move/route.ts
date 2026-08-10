import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { MediaService } from '@/lib/advertisements/services'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json()
    const folderId = typeof body.folderId === 'string' ? body.folderId : null
    const asset = await MediaService.moveAsset(id, folderId)
    return NextResponse.json({ success: true, asset })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to move media asset' }, { status: 500 })
  }
}
