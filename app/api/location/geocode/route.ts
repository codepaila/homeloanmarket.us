import { NextRequest, NextResponse } from 'next/server'
import { geocodeUSAddress } from '@/lib/location/google-place'
import { issueSearchLocationToken } from '@/lib/location/search-token'
import { isSameOriginRequest } from '@/lib/origin'
import { locationLookupExceeded } from '@/lib/rateLimit'

// Bounds the metered Google Geocoding input. A generous cap that never rejects
// a legitimate U.S. address.
const MAX_ADDRESS_LENGTH = 300

export async function POST(request: NextRequest) {
  try {
    // Defense-in-depth origin check for the browser-driven onboarding/search
    // flows. It is NOT the security boundary — the distributed limiter and
    // bounded input below are.
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Invalid request origin' }, { status: 403 })
    }
    const body = await request.json()
    if (typeof body.address !== 'string' || !body.address.trim()) return NextResponse.json({ success: false, error: 'An address is required' }, { status: 400 })
    if (body.address.trim().length > MAX_ADDRESS_LENGTH) {
      return NextResponse.json({ success: false, error: 'Address is too long' }, { status: 400 })
    }
    if (await locationLookupExceeded('geocode', request)) {
      return NextResponse.json({ success: false, error: 'Too many location requests. Please try again later.' }, { status: 429 })
    }
    const location = await geocodeUSAddress(body.address)
    return NextResponse.json({ success: true, location: { ...location, token: issueSearchLocationToken(location) } })
  } catch (error) {
    console.error('Location geocoding failed:', error)
    return NextResponse.json({ success: false, error: 'Location could not be geocoded' }, { status: 400 })
  }
}
