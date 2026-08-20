import { redirect } from 'next/navigation'
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
import { StripeConfigClient } from './StripeConfigClient'

export const dynamic = 'force-dynamic'

export default async function AdminStripeConfigPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const [eventConfig, connection, recentEvents, mode, configured, signatureVerification, audit] = await Promise.all([
    getStripeEventConfig(),
    testStripeConnection(),
    getRecentStripeEvents(25),
    stripeMode(),
    Promise.all([stripeSecretConfigured(), stripeWebhookSecretConfigured()]),
    stripeWebhookSignatureVerificationConfigured(),
    getStripeSecretAudit(),
  ])

  const status = {
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
      processedAt: event.processedAt ? event.processedAt.toISOString() : null,
      createdAt: event.createdAt.toISOString(),
      error: event.error,
    })),
  }

  return <StripeConfigClient status={status} />
}