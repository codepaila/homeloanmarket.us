import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import {
  STRIPE_WEBHOOK_URL,
  getRecentStripeEvents,
  getStripeEventConfig,
  getStripeSecretAudit,
  stripeMode,
  stripeSecretConfigured,
  stripeWebhookSecretConfigured,
  stripeWebhookSignatureVerificationConfigured,
  testStripeConnection,
} from '@/lib/stripe-config'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  // Safe operational status. Secret values are never returned.
  const eventConfig = await getStripeEventConfig()
  const [connection, recentEvents, mode, configured, signatureVerification, audit] = await Promise.all([
    testStripeConnection(),
    getRecentStripeEvents(25),
    stripeMode(),
    Promise.all([stripeSecretConfigured(), stripeWebhookSecretConfigured()]),
    stripeWebhookSignatureVerificationConfigured(),
    getStripeSecretAudit(),
  ])

  return NextResponse.json({
    configured: {
      secretKey: configured[0],
      webhookSecret: configured[1],
    },
    mode,
    connection,
    webhook: {
      endpoint: STRIPE_WEBHOOK_URL,
      signatureVerification,
    },
    events: eventConfig,
    audit,
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      eventId: event.eventId,
      eventType: event.eventType,
      status: event.status,
      eventCreatedAt: event.eventCreatedAt,
      processedAt: event.processedAt,
      createdAt: event.createdAt,
      error: event.error,
    })),
  })
}