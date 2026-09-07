import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import { resolveUserResumePath } from '@/lib/user-resume'
import CompanyRegisterForm from './CompanyRegisterForm'

export default async function CompanyRegisterPage() {
  const user = await getCurrentUser()
  // Canonical resume: an authenticated visitor (broker, company member, or
  // normal USER) is sent to their product resume destination — never a generic
  // home page and never the wrong product.
  if (user) redirect(resolveUserResumePath(user))
  return <CompanyRegisterForm />
}
