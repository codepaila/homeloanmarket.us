import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/company-policy'
import { CompanyDashboardClient } from './CompanyDashboardClient'
import { DeleteAccountDialog } from '@/components/account/DeleteAccountDialog'
import { SubscriptionService } from '@/lib/subscription'
import prisma from '@/lib/prisma'

export default async function CompanyDashboardPage() {
  const current = await getCurrentCompany()
  if (!current) redirect('/auth/signin')

  // Reconcile a pending checkout against Stripe before rendering. This is
  // bounded to this company, idempotent, and never touches an ACTIVE
  // subscription or cancels a live Stripe subscription:
  //  - an abandoned checkout with no live subscription is moved to the neutral
  //    EXPIRED state so "Confirming..." is never permanent;
  //  - a live Stripe subscription that the webhook has not reconciled yet is
  //    synced into the local row so the dashboard reaches ACTIVE without waiting
  //    on provider delivery (the same authoritative sync the webhook uses).
  // The webhook remains the event-driven authority; this is the bounded
  // self-healing path so the dashboard is never stuck on a stale snapshot.
  let subscriptionRecord = current.company.subscription
  if (subscriptionRecord?.status === 'CHECKOUT_PENDING') {
    await SubscriptionService.reconcileStaleCompanyCheckout(current.company.id, subscriptionRecord.stripeCustomerId)
    // The reconcile may have resolved the row (ACTIVE / PAST_DUE / EXPIRED).
    // Re-read so this render reflects the resolved row instead of the
    // pre-reconcile in-memory snapshot.
    subscriptionRecord = await prisma.companySubscription.findUnique({
      where: { companyId: current.company.id },
      include: { advertisingPlan: true },
    })
  }

  const requests = await prisma.companyAdRequest.findMany({
    where: { companyId: current.company.id },
    orderBy: { createdAt: 'desc' },
  })

  const plan = subscriptionRecord?.advertisingPlan
  const subscription = subscriptionRecord
    ? {
        status: subscriptionRecord.status,
        isActive: subscriptionRecord.isActive,
        stripeCustomerId: subscriptionRecord.stripeCustomerId,
        startDate: subscriptionRecord.startDate,
        endDate: subscriptionRecord.endDate,
        plan: plan
          ? { name: plan.name, price: plan.price, currency: plan.currency, billingInterval: plan.billingInterval }
          : { name: subscriptionRecord.plan },
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
