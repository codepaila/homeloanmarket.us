import { NextResponse } from 'next/server'
import { getUSStates } from '@/lib/location'

// Serves the canonical US state list (name + two-letter code) from the
// existing `countries-states-cities` location library.
export async function GET() {
  try {
    const states = getUSStates()
    return NextResponse.json({
      success: true,
      states,
      total: states.length,
    })
  } catch (error) {
    console.error('Error fetching states:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch states',
        states: [],
        total: 0,
      },
      { status: 500 },
    )
  }
}
