import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { stripeSecretConfigured, testStripeConnection } from '@/lib/stripe-config'

export async function POST() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  if (!(await stripeSecretConfigured())) {
    return NextResponse.json({ message: 'Stripe Secret Key is not configured' }, { status: 503 })
  }

  const result = await testStripeConnection()
  if (!result.ok) {
    // Return only a sanitized message — never the raw key or Stripe response.
    return NextResponse.json({ message: result.error }, { status: 502 })
  }
  // result already contains ok, mode, and safe account metadata.
  return NextResponse.json(result)
}