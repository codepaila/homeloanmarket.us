import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/company-policy'
import { CompanyDashboardClient } from './CompanyDashboardClient'
import { DeleteAccountDialog } from '@/components/account/DeleteAccountDialog'
import { SubscriptionService } from '@/lib/subscription'

export default async function CompanyDashboardPage() {
  const current = await getCurrentCompany()
  if (!current) redirect('/auth/signin')

  // Abandoned-checkout self-healing: if the local subscription is stuck in
  // CHECKOUT_PENDING (an abandoned Stripe Checkout with no live subscription),
  // reconcile it to the neutral EXPIRED state so the dashboard never shows a
  // permanent "Confirming your subscription..." state. This is bounded to this
  // company, idempotent, and never touches an ACTIVE subscription or a live
  // Stripe subscription. The webhook's checkout.session.expired handler is the
  // authoritative event-driven path; this is the belt-and-suspenders reconcile
  // so the dashboard self-heals on refresh even if that webhook was never sent.
  const pendingSubscription = current.company.subscription
  if (pendingSubscription?.status === 'CHECKOUT_PENDING') {
    await SubscriptionService.reconcileStaleCompanyCheckout(current.company.id, pendingSubscription.stripeCustomerId)
  }
  const requests = await import('@/lib/prisma').then(({ default: prisma }) => prisma.companyAdRequest.findMany({
    where: { companyId: current.company.id },
    orderBy: { createdAt: 'desc' },
  }))

  const plan = current.company.subscription?.advertisingPlan
  const subscription = current.company.subscription
    ? {
        status: current.company.subscription.status,
        isActive: current.company.subscription.isActive,
        stripeCustomerId: current.company.subscription.stripeCustomerId,
        startDate: current.company.subscription.startDate,
        endDate: current.company.subscription.endDate,
        plan: plan
          ? { name: plan.name, price: plan.price, currency: plan.currency, billingInterval: plan.billingInterval }
          : { name: current.company.subscription.plan },
      }
    : null

  return (
    <div className="space-y-6">
      <CompanyDashboardClient company={{ ...current.company, subscription }} requests={requests} onboarded={Boolean(current.company.onboardedAt)} />
      <section className="mx-auto w-full max-w-4xl rounded border border-destructive/40 bg-card p-5">
        <h2 className="font-semibold">Delete company account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This permanently removes the company, its advertising requests and advertisements,
          membership data, uploaded media, and any active advertising subscription (cancelled
          first). Global advertising plans are never affected.
        </p>
        <div className="mt-4">
          <DeleteAccountDialog
            triggerLabel="Delete company"
            title="Delete company account?"
            description="This permanently removes the company, advertising requests, advertisements, membership data, and associated account data. Any active advertising subscription will be cancelled."
            endpoint="/api/account/company"
            signOutAfterSuccess
          />
        </div>
      </section>
    </div>
  )
}
