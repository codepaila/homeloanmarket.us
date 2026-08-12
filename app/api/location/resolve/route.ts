import { NextRequest, NextResponse } from 'next/server'
import { resolveUSPlace } from '@/lib/location/google-place'
import { issueSearchLocationToken } from '@/lib/location/search-token'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (typeof body.placeId !== 'string' || !body.placeId.trim()) {
      return NextResponse.json({ success: false, error: 'A place ID is required' }, { status: 400 })
    }
    const location = await resolveUSPlace(body.placeId)
    return NextResponse.json({ success: true, location: { ...location, token: issueSearchLocationToken(location) } })
  } catch (error) {
    console.error('Location resolution failed:', error)
    return NextResponse.json({ success: false, error: 'Selected location could not be resolved' }, { status: 400 })
  }
}
