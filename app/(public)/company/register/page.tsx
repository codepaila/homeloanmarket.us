import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import CompanyRegisterForm from './CompanyRegisterForm'

export default async function CompanyRegisterPage() {
  const user = await getCurrentUser()
  if (user?.isBroker) redirect('/broker/dashboard')
  if (user && user.companyMemberships && user.companyMemberships.length > 0) redirect('/company/dashboard')
  return <CompanyRegisterForm />
}
