// app/setup/page.tsx
// Server-rendered broker onboarding page. The redirect decision is made on the
// server using the same authoritative state machine as /broker/dashboard, so
// /setup and /broker/dashboard can never disagree and bounce the broker
// between them. Draft data is loaded server-side on every request, making the
// page fully reload-safe (F5 / back / forward always restores the saved draft).
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import { resolveBrokerOnboardingDestination } from '@/lib/broker-onboarding-state'
import { BrokerSetupWizard } from '@/components/sections/broker/BrokerSetupWizard'

export default async function BrokerSetupPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  // Single authoritative onboarding gate. /setup renders only when the state
  // machine says the broker should be here; completed brokers go straight to
  // /broker/dashboard, subscription-pending brokers to plan selection.
  const destination = resolveBrokerOnboardingDestination(user, '/setup')
  if (destination) {
    redirect(destination)
  }

  // Restore the saved server-side onboarding draft. A draft is NOT the same as
  // a completed profile: the wizard stays on /setup until the completion API
  // successfully creates the Broker profile.
  const draft = user.brokerRegistration?.draft
  const draftData = draft?.data && typeof draft.data === 'object' && !Array.isArray(draft.data) ? draft.data : {}
  const initialData = draftData as Record<string, unknown>
  const initialStep = Number.isInteger(draft?.currentStep) ? (draft?.currentStep as number) : 1

  // Minimal serializable user for the client wizard (refreshSession reads the
  // authoritative session itself).
  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
  }

  return (
    <div className="min-h-screen bg-background py-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Become a Verified Mortgage Broker
          </h1>
          <p className="mx-auto mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Join America&apos;s leading mortgage marketplace and connect with borrowers across the United States.
          </p>
        </div>

        <BrokerSetupWizard user={sessionUser} initialData={initialData} initialStep={initialStep} />
      </div>
    </div>
  )
}