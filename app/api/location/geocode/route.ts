import { NextRequest, NextResponse } from 'next/server'
import { geocodeUSAddress } from '@/lib/location/google-place'
import { issueSearchLocationToken } from '@/lib/location/search-token'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (typeof body.address !== 'string' || !body.address.trim()) return NextResponse.json({ success: false, error: 'An address is required' }, { status: 400 })
    const location = await geocodeUSAddress(body.address)
    return NextResponse.json({ success: true, location: { ...location, token: issueSearchLocationToken(location) } })
  } catch (error) {
    console.error('Location geocoding failed:', error)
    return NextResponse.json({ success: false, error: 'Location could not be geocoded' }, { status: 400 })
  }
}
