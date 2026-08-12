import { NextRequest, NextResponse } from 'next/server'
import { autocompleteUSPlaces } from '@/lib/location/google-place'

export async function GET(request: NextRequest) {
  try {
    const input = request.nextUrl.searchParams.get('input') || ''
    return NextResponse.json({ success: true, suggestions: await autocompleteUSPlaces(input) })
  } catch (error) {
    console.error('Location autocomplete failed:', error)
    return NextResponse.json({ success: false, error: 'Location autocomplete is unavailable' }, { status: 503 })
  }
}
