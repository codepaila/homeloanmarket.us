import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/company-policy'
import { CompanyDashboardClient } from './CompanyDashboardClient'
import { DeleteAccountDialog } from '@/components/account/DeleteAccountDialog'

export default async function CompanyDashboardPage() {
  const current = await getCurrentCompany()
  if (!current) redirect('/auth/signin')
  if (!current.company.onboardedAt) redirect('/company/onboarding')
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
      <CompanyDashboardClient company={{ ...current.company, subscription }} requests={requests} />
      <section className="mx-auto w-full max-w-4xl rounded-xl border border-destructive/40 bg-card p-5">
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
