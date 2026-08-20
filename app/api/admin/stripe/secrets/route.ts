import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import {
  setStripeSecretKey,
  setStripeWebhookSecret,
  stripeMode,
} from '@/lib/stripe-config'

// ADMIN-only. Saves or replaces the Stripe secret key / webhook signing
// secret. Secrets are encrypted at rest and NEVER returned in the response.
// No arbitrary environment-variable mutation, no client-controlled config keys.
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const field = (body as { field?: unknown })?.field
  const value = (body as { value?: unknown })?.value
  const replace = (body as { replace?: unknown })?.replace === true

  if (field !== 'secretKey' && field !== 'webhookSecret') {
    return NextResponse.json({ message: 'Invalid configuration field' }, { status: 422 })
  }
  if (typeof value !== 'string') {
    return NextResponse.json({ message: 'A secret value is required' }, { status: 422 })
  }

  const result =
    field === 'secretKey'
      ? await setStripeSecretKey(value, user.id, replace)
      : await setStripeWebhookSecret(value, user.id, replace)

  if (!result.ok) return NextResponse.json({ message: result.error }, { status: 422 })

  // Audit (non-secret): record which field changed, never the value.
  console.info('Admin updated Stripe configuration', {
    adminId: user.id,
    field: field === 'secretKey' ? 'secretKey' : 'webhookSecret',
    action: replace || result.configured ? 'REPLACE' : 'SET',
  })

  return NextResponse.json({ ok: true, configured: result.configured, mode: await stripeMode() })
}
