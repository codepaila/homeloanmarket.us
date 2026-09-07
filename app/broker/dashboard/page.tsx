// app/broker/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import { BrokerDashboard } from '@/components/sections/broker/BrokerDashboard'
import { DeleteAccountDialog } from '@/components/account/DeleteAccountDialog'
import { roleHome } from '@/lib/auth-redirect'
import { toBrokerOwnerDto } from '@/lib/broker-owner-dto'
import { isBrokerSetupComplete, resolveBrokerOnboardingDestination } from '@/lib/broker-onboarding-state'

export default async function BrokerPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  if (user.role !== 'BROKER') {
    redirect(roleHome(user.role))
  }

  // Single authoritative onboarding gate: this page renders only when the
  // broker onboarding state machine says the dashboard is the correct page.
  // Incomplete / draft / subscription-pending / not-started brokers are
  // redirected exactly once to the canonical destination.
  if (!isBrokerSetupComplete(user)) {
    const destination = resolveBrokerOnboardingDestination(user, '/broker/dashboard')
    redirect(destination ?? '/setup')
  }

  // The broker dashboard is a professional profile-management home. It renders
  // identity, status, contact and office information from the owner DTO and
  // intentionally carries no lead/contact-message, rating or review data.
  const initialData = {
    broker: toBrokerOwnerDto(user.brokerProfile),
  }

  return (
    <div className="space-y-6">
      <BrokerDashboard initialData={initialData} />
      <section className="rounded border border-destructive/40 bg-card p-6">
        <h2 className="text-lg font-semibold">Delete mortgage originator account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This permanently removes your mortgage originator profile, claim history, messages, reviews, uploaded
          media, and any active subscription (cancelled first) and logs you out.
        </p>
        <div className="mt-4">
          <DeleteAccountDialog
            triggerLabel="Delete my account"
            title="Delete your account?"
            description="This permanently removes your account and associated data. Any active subscription will be cancelled before deletion."
            endpoint="/api/account/broker"
            signOutAfterSuccess
          />
        </div>
      </section>
    </div>
  )
}