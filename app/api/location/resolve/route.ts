import { NextRequest, NextResponse } from 'next/server'
import { resolveUSPlace } from '@/lib/location/google-place'
import { issueSearchLocationToken } from '@/lib/location/search-token'
import { isSameOriginRequest } from '@/lib/origin'
import { locationLookupExceeded } from '@/lib/rateLimit'

// Bounds the metered Google Place Details input (the resolver regex is the
// primary charset guard; this caps overall length).
const MAX_PLACE_ID_LENGTH = 200

export async function POST(request: NextRequest) {
  try {
    // Defense-in-depth origin check for the browser-driven onboarding/search
    // flows. It is NOT the security boundary — the distributed limiter and
    // bounded input below are.
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Invalid request origin' }, { status: 403 })
    }
    const body = await request.json()
    if (typeof body.placeId !== 'string' || !body.placeId.trim()) {
      return NextResponse.json({ success: false, error: 'A place ID is required' }, { status: 400 })
    }
    if (body.placeId.length > MAX_PLACE_ID_LENGTH) {
      return NextResponse.json({ success: false, error: 'Place ID is too long' }, { status: 400 })
    }
    if (await locationLookupExceeded('resolve', request)) {
      return NextResponse.json({ success: false, error: 'Too many location requests. Please try again later.' }, { status: 429 })
    }
    const location = await resolveUSPlace(body.placeId)
    return NextResponse.json({ success: true, location: { ...location, token: issueSearchLocationToken(location) } })
  } catch (error) {
    console.error('Location resolution failed:', error)
    return NextResponse.json({ success: false, error: 'Selected location could not be resolved' }, { status: 400 })
  }
}
