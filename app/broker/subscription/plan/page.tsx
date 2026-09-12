// app/broker/subscription/plan/page.tsx
//
// Post-claim plan experience for an admin-created broker. This is a focused,
// server-rendered successor to the claim flow — NOT the subscription
// overview/management page (that remains app/broker/subscription/page.tsx).
//
// Everything is resolved on the server from the canonical broker auth +
// subscription services, so there is no client-side mount → API → cache
// waterfall. The only client interaction is the Mortgage Expert checkout, which
// delegates to the existing POST /api/subscription/checkout flow (the exact flow
// used by self-register brokers). No subscription is created or repaired here.
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/currentUser'
import { roleHome } from '@/lib/auth-redirect'
import { isBrokerSetupComplete, resolveBrokerOnboardingDestination } from '@/lib/broker-onboarding-state'
import { listBrokerPlansPublic } from '@/lib/broker-plans'
import { ClaimPlanExperience } from './ClaimPlanExperience'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function BrokerClaimPlanPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  // Authoritative authorization: the canonical broker relationship (an attached
  // broker profile), not merely a role string. USER/COMPANY/ADMIN identities are
  // routed by the existing role semantics.
  if (user.role !== 'BROKER') {
    redirect(roleHome(user.role))
  }

  // A broker without an attached profile belongs in the existing onboarding
  // flow. A COMPLETED broker — including a just-claimed admin-created broker —
  // deliberately skips the onboarding state machine so this claim-success
  // destination is honored: the machine canonicalizes COMPLETED brokers to
  // /broker/dashboard and would otherwise intercept this page.
  if (!isBrokerSetupComplete(user)) {
    const destination = resolveBrokerOnboardingDestination(user, '/broker/subscription/plan')
    redirect(destination ?? '/setup')
  }

  const plans = await listBrokerPlansPublic()
  const subscription = user.brokerProfile?.subscription ?? null
  const currentPlan = subscription?.plan || user.subscriptionPlan || 'FREE'
  const brokerName =
    user.brokerProfile?.companyName || user.brokerProfile?.displayName || 'there'

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <ClaimPlanExperience brokerName={brokerName} currentPlan={currentPlan} plans={plans} />
    </div>
  )
}
