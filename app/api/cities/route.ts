import { NextResponse } from 'next/server'
import { getUSCities, getUSStateCode } from '@/lib/location'

// Serves US city names from the canonical location library
// (the same `countries-states-cities` source used across the platform).
// Optionally filter by two-letter US state code: /api/cities?state=CA
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const stateParam = (searchParams.get('state') || '').trim()

    const stateCode = stateParam
      ? (getUSStateCode(stateParam) || stateParam.toUpperCase())
      : undefined

    const cities = getUSCities(stateCode)

    return NextResponse.json({
      success: true,
      cities,
      total: cities.length,
    })
  } catch (error) {
    console.error('Error fetching cities:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cities',
        cities: [],
        total: 0,
      },
      { status: 500 },
    )
  }
}
