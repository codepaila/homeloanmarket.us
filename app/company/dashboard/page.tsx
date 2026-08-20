import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/company-policy'
import { CompanyDashboardClient } from './CompanyDashboardClient'

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

  return <CompanyDashboardClient company={{ ...current.company, subscription }} requests={requests} />
}
