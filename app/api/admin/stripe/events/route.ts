import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { updateStripeEventConfig } from '@/lib/stripe-config'

export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const enabledTypes = (body as { enabledTypes?: unknown })?.enabledTypes
  const result = await updateStripeEventConfig(enabledTypes)

  if (!result.ok) return NextResponse.json({ message: result.error }, { status: 422 })

  // Audit log (non-secret) — records the safe enabled-event state, never keys.
  console.info('Admin updated Stripe event configuration', {
    adminId: user.id,
    enabledTypes: result.config.filter((event) => event.enabled).map((event) => event.type),
  })

  return NextResponse.json({ ok: true, events: result.config })
}