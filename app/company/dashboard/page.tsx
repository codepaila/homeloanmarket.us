import { redirect } from 'next/navigation'
import { getCurrentCompany } from '@/lib/company-policy'
import { CompanyDashboardClient } from './CompanyDashboardClient'

export default async function CompanyDashboardPage() {
  const current = await getCurrentCompany()
  if (!current) redirect('/auth/signin')
  if (!current.company.onboardedAt) redirect('/company/onboarding')
  const requests = await import('@/lib/prisma').then(({ default: prisma }) => prisma.companyAdRequest.findMany({ where: { companyId: current.company.id }, orderBy: { createdAt: 'desc' } }))
  return <CompanyDashboardClient company={current.company} requests={requests} />
}
