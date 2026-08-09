// app/api/property-types/route.ts
import { NextResponse } from 'next/server'

const PROPERTY_TYPES = [
  'Residential',
  'Commercial',
  'Plot',
  'Agricultural',
  'Industrial',
  'Apartment',
  'Villa',
  'Independent House',
  'Plot + Construction',
  'Shop',
  'Office Space',
  'Warehouse',
  'Farm House'
]

export async function GET() {
  try {
    return NextResponse.json({ 
      success: true, 
      propertyTypes: PROPERTY_TYPES,
      total: PROPERTY_TYPES.length
    })
  } catch (error) {
    console.error('Error fetching property types:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch property types',
        propertyTypes: PROPERTY_TYPES.slice(0, 5) // Fallback
      },
      { status: 500 }
    )
  }
}