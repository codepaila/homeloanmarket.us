// app/broker-registration/subscription/success/page.tsx
//
// Server-side Stripe Checkout return handler for broker registration FEATURED
// checkout. This page performs the authoritative verification and finalization
// entirely server-side and redirects directly to /broker/dashboard — the user
// never visits /setup or the Review/plan steps after a successful checkout.
//
//   Stripe success_url → this page (GET, server component)
//     → verifyBrokerRegistrationCheckout() (Stripe session + subscription
//       ownership/status validation, registration subscription → ACTIVE)
//     → finalizeBrokerRegistration() (Broker + BrokerSubscription, idempotent)
//     → redirect /broker/dashboard
//
// Security/authority is preserved: the browser never provides price or
// ACTIVE-subscription state; finalizeBrokerRegistration enforces ownership,
// profile completeness, ACTIVE subscription, and duplicate prevention. A
// cancelled/failed/unverified return redirects back to plan selection and never
// finalizes.
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import { verifyBrokerRegistrationCheckout } from '@/lib/broker-registration-verify'
import { finalizeBrokerRegistration } from '@/lib/broker-registration'
import { sendAdminNewBrokerNotification } from '@/actions/email.action'

export default async function BrokerRegistrationSubscriptionSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const params = await searchParams
  const sessionId = params.session_id || ''

  const user = await getCurrentUser()
  if (!user) {
    redirect('/auth/signin')
  }

  if (!sessionId || !sessionId.startsWith('cs_')) {
    redirect('/setup')
  }

  const verified = await verifyBrokerRegistrationCheckout({ user, sessionId })
  if (!verified.ok) {
    // Not a valid paid checkout return (cancelled, incomplete, or ownership
    // mismatch). Never finalize; send the broker back into the canonical setup
    // flow where plan selection resumes on Step 6.
    redirect('/setup')
  }

  // The registration subscription is now authoritative ACTIVE. Finalize exactly
  // once (idempotent: a webhook-first or duplicate return returns the existing
  // Broker without creating a duplicate). If the profile is incomplete,
  // finalizeBrokerRegistration rejects and the broker continues on /setup.
  try {
    const broker = await finalizeBrokerRegistration(user.id)
    // Fire-and-forget admin "new broker" notification for every configured
    // ADMIN_EMAILS recipient at the broker-created moment. The Broker profile
    // now exists (unlike at registration time). A failure never undoes the
    // finalization.
    void sendAdminNewBrokerNotification(broker.id)
  } catch {
    redirect('/setup')
  }

  redirect('/broker/dashboard')
}