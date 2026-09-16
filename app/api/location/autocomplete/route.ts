import { NextRequest, NextResponse } from 'next/server'
import { autocompleteUSPlaces } from '@/lib/location/google-place'
import { locationLookupExceeded } from '@/lib/rateLimit'

// Bounds the metered Google Places Autocomplete input. A generous cap that
// never rejects a legitimate U.S. address/place query.
const MAX_AUTOCOMPLETE_INPUT = 100

export async function GET(request: NextRequest) {
  try {
    const input = request.nextUrl.searchParams.get('input') || ''
    if (input.length > MAX_AUTOCOMPLETE_INPUT) {
      return NextResponse.json({ success: false, error: 'Search input is too long' }, { status: 400 })
    }
    if (await locationLookupExceeded('autocomplete', request)) {
      return NextResponse.json({ success: false, error: 'Too many location requests. Please try again later.' }, { status: 429 })
    }
    return NextResponse.json({ success: true, suggestions: await autocompleteUSPlaces(input) })
  } catch (error) {
    console.error('Location autocomplete failed:', error)
    return NextResponse.json({ success: false, error: 'Location autocomplete is unavailable' }, { status: 503 })
  }
}
